const router = require("express").Router();
const { check, validationResult } = require("express-validator");

const UserModel = require("../models/Users");
const PaymentModel = require("../models/Payments");
const WalletModel = require("../models/Wallets");
const helperFunctions = require("../middleware/helperFunctions");
const FLW_calls = require("../middleware/FLW_calls");
//Send mail
const sendEmail = require("../middleware/sendEmail");

router.get("/payment-link-callback/:txref", async (req, res) => {
  let txref = req.params.txref;
  const transaction = await PaymentModel.findOne({ txref });
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
});

router.post("/payment-link-callback/:txref", async (req, res) => {
  let txref = req.params.txref;
  const transaction = await PaymentModel.findOne({ txref });
  if (!transaction) {
    return res.status(404).json({
      errors: [
        {
          msg: "Transaction not found"
        }
      ]
    });
  }
  if (req.query.cancelled) {
    //update transaction status to cancelled
    let updatedTransaction = await PaymentModel.updateOne(
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
      updatedTransaction = await PaymentModel.updateOne(
        { txref },
        { flwref, status: "awaiting-verification" }
      );
    if (updatedTransaction.n > 0) {
      //verify payment before giving value
      const verifiedTx = await helperFunctions.verifyPayment(
        txref,
        transaction,
        "paymentlink"
      );
      if (verifiedTx) {
        await PaymentModel.updateOne(
          { txref },
          { flwref, status: "successful" }
        );
        let receiver = await UserModel.findById(transaction.receiverid);
        //send email receipt to payer
        const receipt_from = '"Payperless.com" <payments@payperless.com>';
        const receipt_subject =
          "Your payment was successful via Payperless.com";
        const receiptEmailTemplate = require("../middleware/Emails/receipt");
        const receipt_messageBody = receiptEmailTemplate(
          receiver,
          transaction,
          verifiedTx
        );

        if (receiver.customerreceipt) {
          const recp_emailSent = await sendEmail(
            receipt_from,
            transaction.senderemail,
            receipt_subject,
            receipt_messageBody
          ).catch(console.error);
        }

        if (receiver.userreceipt) {
          setTimeout(async () => {
            //send email payment notifictaion to receiver
            const notif_from = '"Payperless.com" <payments@payperless.com>';
            const notif_subject =
              "You just got paid via your Payperless.com link";
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
            txtype: "paymentlink",
            balance: helperFunctions.calcPPLCharge(transaction.amount)
          });
          updatedWallet = await newWallet.save();
        } else {
          //get the last wallet document
          let lastWallet = receiverWallet[receiverWallet.length - 1];

          let lastWalletBalance = Number(lastWallet.balance.toFixed(2));
          let newBalance =
            Number(lastWalletBalance) +
            Number(helperFunctions.calcPPLCharge(transaction.amount));
          //insert a new Wallet document
          const newWallet = new WalletModel({
            receiverid: transaction.receiverid,
            paymentid: transaction._id,
            transactionid: verifiedTx.id,
            txamount: Number(transaction.amount.toFixed(2)),
            txtype: "paymentlink",
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

        return res.redirect(`/pay/payment-link-callback/${txref}`);
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
  let paymentlink = process.env.DOMAIN + "/pay/" + req.params.id;
  try {
    const receiver = await UserModel.findOne({ paymentlink });
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
    check("amount")
      .not()
      .isEmpty(),
    check("firstname")
      .not()
      .isEmpty(),
    check("lastname")
      .not()
      .isEmpty(),
    check("email").isEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }

    let paymentlink = process.env.DOMAIN + "/pay/" + req.params.id;
    const receiver = await UserModel.findOne({ paymentlink });
    const { firstname, lastname, email, phone, amount } = req.body;
    const payment = new PaymentModel({
      amount: Number(amount).toFixed(2),
      receiverid: receiver.id,
      senderfirstname: firstname,
      senderlastname: lastname,
      senderemail: email,
      senderphone: phone,
      paymenttype: "paymentlink",
      status: "pending"
    });

    payment.save();

    //call flutterwave to handle payment
    let txref =
        "PPL-" +
        Math.random()
          .toString(36)
          .substr(2, 11),
      public_key = process.env.FLW_PUBLIC_KEY,
      redirect_url = process.env.DOMAIN + `/pay/payment-link-callback/${txref}`;

    let amountToPay = Number(payment.amount.toFixed(2));
    let { senderemail, senderphone, senderfirstname, senderlastname } = payment;

    let payText = `PAY ${helperFunctions.prettyCurrency(amountToPay)}`;
    const payload = {
      amount: amountToPay,
      customer_email: senderemail,
      customer_phone: senderphone,
      customer_firstname: senderfirstname,
      customer_lastname: senderlastname,
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
      let updatePayment = await PaymentModel.updateOne(
        { _id: payment.id },
        { paymentlink: paymentResponse.data.link, txref }
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
