const router = require("express").Router();
const { check, validationResult } = require("express-validator");
const axios = require("axios");

const UserModel = require("../models/Users");
const InvoiceModel = require("../models/Invoices");
const WalletModel = require("../models/Wallets");
const helperFunctions = require("../middleware/helperFunctions");
const FLW_calls = require("../middleware/FLW_calls");

//Send mail
const sendEmail = require("../middleware/sendEmail");

router.get("/payment-redirect/:txref", async (req, res) => {
  let txref = req.params.txref;
  console.log(txref);
  const transaction = await InvoiceModel.findOne({ txref });
  if (!transaction) {
    return res.json({
      errors: [
        {
          msg: "Transaction not found"
        }
      ]
    });
  }
  return res.json({ transaction, status: true });
  // return res.json(req.query);
});

router.post("/payment-redirect/:txref", async (req, res) => {
  let txref = req.params.txref;
  console.log(txref);
  const transaction = await InvoiceModel.findOne({ txref });
  if (!transaction) {
    return res.json({
      errors: [
        {
          msg: "Transaction not found"
        }
      ]
    });
  }
  if (req.query.cancelled) {
    //update transaction status to cancelled
    let updatedTransaction = await InvoiceModel.updateOne(
      { txref },
      { status: "cancelled" }
    );
    return res.json({
      errors: [
        {
          msg: "Payment has been cancelled"
        }
      ]
    });
  }

  if (req.query.flwref) {
    let flwref = req.query.flwref,
      updatedTransaction = await InvoiceModel.updateOne(
        { txref },
        { flwref, status: "awaiting-verification", paidon: new Date() }
      );
    if (updatedTransaction.n > 0) {
      //verify payment before giving value
      const verifiedTx = await helperFunctions.verifyPayment(
        txref,
        transaction,
        "invoice"
      );
      if (verifiedTx) {
        await InvoiceModel.updateOne(
          { txref },
          { flwref, paymentstatus: "successful" }
        );

        let receiver = await UserModel.findById(transaction.receiverid);
        //send email receipt to payer
        const receipt_from = '"Payperless.com" <payments@payperless.com>';
        const receipt_subject =
          "Invoice payment via Payperless.com was successful";
        const receiptEmailTemplate = require("../middleware/Emails/receipt");
        const receipt_messageBody = receiptEmailTemplate(
          receiver,
          transaction,
          verifiedTx
        );

        if (receiver.customerreceipt) {
          const recp_emailSent = await sendEmail(
            receipt_from,
            transaction.customer.email,
            receipt_subject,
            receipt_messageBody
          ).catch(console.error);
        }

        if (receiver.userreceipt) {
          setTimeout(async () => {
            //send email payment notifictaion to receiver
            const notif_from = '"Payperless.com" <payments@payperless.com>';
            const notif_subject =
              "An invoice has just been paid with PAYperless";
            const notifEmailTemplate = require("../middleware/Emails/payment_notification");
            const notif_messageBody = notifEmailTemplate(
              receiver,
              transaction,
              verifiedTx
            );
            const notif_emailSent = await sendEmail(
              notif_from,
              receiver.email,
              notif_subject,
              notif_messageBody
            ).catch(console.error);
          }, 5000);
        }

        //get current wallet balance of receiver
        const receiverWallet = await WalletModel.find({
          receiverid: transaction.receiverid
        });

        let updatedWallet;
        if (receiverWallet === null || receiverWallet.length === 0) {
          //insert a new Wallet document
          const newWallet = new WalletModel({
            receiverid: transaction.receiverid,
            paymentid: transaction._id,
            transactionid: verifiedTx.id,
            txamount: Number(transaction.amount.toFixed(2)),
            txtype: "invoice",
            balance: helperFunctions.calcPPLCharge(transaction.amount)
          });
          updatedWallet = await newWallet.save();
        } else {
          //get the last wallet document
          let lastWallet = receiverWallet[receiverWallet.length - 1],
            lastWalletBalance = Number(lastWallet.balance.toFixed(2));
          let newBalance =
            Number(lastWalletBalance) +
            Number(helperFunctions.calcPPLCharge(transaction.amount));
          //insert a new Wallet document
          const newWallet = new WalletModel({
            receiverid: transaction.receiverid,
            paymentid: transaction._id,
            transactionid: verifiedTx.id,
            txamount: Number(transaction.amount.toFixed(2)),
            txtype: "invoice",
            balance: Number(newBalance)
          });

          updatedWallet = await newWallet.save();
        }

        //if receiver settings is set to instant settlement, make payment now.
        if (receiver.settlementtype === "instant") {
          const instantSettlementResp = await helperFunctions.runInstantSettlement(
            receiver,
            transaction
          );
        }

        return res.redirect(`/pay-invoice/payment-redirect/${txref}`);
        // return res.status(200).json({ txref, flwref, updatedWallet });
      } else {
        return res.json({
          errors: [
            {
              msg: "Payment was not verified"
            }
          ]
        });
      }
    }
  }
});

router.get("/p/:id", async (req, res) => {
  const invoice = await InvoiceModel.findOne({ txref: req.params.id });

  if (!invoice) {
    return res.status(404).json({
      errors: [
        {
          msg: "Invoice not found"
        }
      ]
    });
  }
  res.status(200).json({ invoice });
});

router.get("/getReceiver/:id", async (req, res) => {
  try {
    const receiver = await UserModel.findById(req.params.id);
    res.status(200).json({ receiver });
  } catch (err) {
    return res.json({
      errors: [
        {
          msg: "Receiver was not found"
        }
      ]
    });
  }
});

router.post(
  "/:id",
  [
    check("txref")
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    let txref = req.params.id;
    const invoiceDetails = await InvoiceModel.findOne({ txref });
    if (!invoiceDetails) {
      return res.status(404).json({
        errors: [
          {
            msg: "Invoice not found"
          }
        ]
      });
    }
    const invoice = await InvoiceModel.updateOne(
      { txref },
      {
        paymentstatus: "attempting-payment"
      }
    );
    if (invoice.n <= 0) {
      return res.status(404).json({
        errors: [
          {
            msg: "Could not update invoice status"
          }
        ]
      });
    }

    //call flutterwave to handle payment
    let newtxref =
      "INV-" +
      Math.random()
        .toString(36)
        .substr(2, 11);
    let public_key = process.env.FLW_PUBLIC_KEY,
      redirect_url =
        process.env.DOMAIN + `/pay-invoice/payment-redirect/${txref}`;

    let amountToPay = Number(invoiceDetails.amount.toFixed(2));
    let { customer } = invoiceDetails;

    let payText = `PAY ${helperFunctions.prettyCurrency(amountToPay)}`;
    const payload = {
      amount: amountToPay,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_firstname: customer.firstname,
      customer_lastname: customer.lastname,
      pay_button_text: payText,
      currency: "NGN",
      txref,
      PBFPubKey: public_key,
      redirect_url: redirect_url,
      onclose: () => console.log("hiiiii close")
    };
    try {
      const paymentResponse = await FLW_calls.initiatePayment(payload);

      //update with payment link
      let updatePayment = await InvoiceModel.updateOne(
        { _id: invoiceDetails.id },
        { flw_paymentlink: paymentResponse.data.link, newtxref }
      );

      if (updatePayment.n > 0) {
        return res.status(200).json(paymentResponse);
      } else {
        return res.json({
          errors: [
            {
              msg: "Could not generate payment link. Try again"
            }
          ]
        });
      }
    } catch (err) {
      return res.status(404).json({
        errors: [
          {
            msg: "Payment could not be processed, Try again",
            error: err
          }
        ]
      });
    }

    // return res.status(200).json({ payment });
  }
);

module.exports = router;
