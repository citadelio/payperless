const TransactionModel = require("../models/Transactions");
const UserModel = require("../models/Users");
const BankdataModel = require("../models/Bankdata");
const FLW_calls = require("./FLW_calls");

const calcPPLCharge2 = amount => {
  let stampDuty = amount >= 1000 ? 50 : 0;
  let calcCharge = amount - process.env.PPLCharge * amount;
  let charge = calcCharge - stampDuty;
  return Number(charge).toFixed(2);
};

const getMerchantsToBeSettled = async () => {
  // let td = new Date();
  let td = new Date(new Date().setDate(new Date().getDate() + 1));
  let today = td.setHours(0, 0, 0, 0);

  const toBeSettled = await TransactionModel.find({
    settlementstatus: { $ne: "settled" },
    settlementdate: { $lte: today }
  }).distinct("receiverId");
  return toBeSettled;
};

const runSettleMerchants = async merchantsToBeSettled => {
  // let td = new Date();
  let td = new Date(new Date().setDate(new Date().getDate() + 1));
  let today = td.setHours(0, 0, 0, 0);
  //get all amount for each user
  merchantsToBeSettled.map(async merchantid => {
    let merchantDetail = await TransactionModel.find({
      settlementstatus: { $ne: "settled" },
      settlementdate: { $lte: today },
      receiverId: merchantid
    }).select("pplamountSettled");
    //sum up all amounts for this user
    let totalAmount = 0;
    if (merchantDetail.length > 0) {
      merchantDetail.map(singleAmount => {
        totalAmount =
          Number(totalAmount) + Number(singleAmount.pplamountSettled);
      });
      totalAmount =
        Number(totalAmount) - Number(process.env.PPLSETTLEMENTCHARGE);
    }
    //get Bank details of User
    let userBankdata = await BankdataModel.findOne({
      userid: merchantid,
      isprimary: true
    });
    let txref =
      "BTRSF-" +
      Math.random()
        .toString(36)
        .substr(2, 11);
    if (userBankdata) {
      // bankdataPayload = {
      //   Bank: userBankdata.bankcode,
      //   "Account Number": userBankdata.accountnumber,
      //   Amount: Number(totalAmount),
      //   Currency: "NGN",
      //   Narration: `payperless.com transfer to ${userBankdata.accountname}`,
      //   Reference: txref
      // };
      const initiateTransfer = await FLW_calls.singleTransfer(
        userBankdata.accountnumber,
        userBankdata.accountname,
        userBankdata.bankcode,
        totalAmount,
        txref
      );
      if (initiateTransfer.status === "success");
      {
        console.log(
          `NGN${totalAmount} sent to ${userBankdata.accountname} - ${userBankdata.accountnumber} - ${userBankdata.bankcode} with reference ${txref}`
        );
      }
    }

    //  return bankdataPayload;
  });
};

module.exports = {
  prettyCurrency: amount => {
    const formatter = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2
    });
    const convertedAmount = formatter.format(amount);
    return convertedAmount;
  },

  calcPPLCharge: amount => {
    let stampDuty = amount >= 1000 ? 50 : 0;
    let calcCharge = amount - process.env.PPLCharge * amount;
    let charge = calcCharge - stampDuty;
    return Number(charge).toFixed(2);
  },
  verifyPayment: async (txref, transaction, txtype) => {
    console.log(txref);
    const payload = {
      txref,
      SECKEY: process.env.FLW_SECRET_KEY
    };

    // set settlement date to a day later
    let settlementdate = new Date(
      new Date().setDate(new Date().getDate() + 1)
    ).setHours(0, 0, 0, 0);
    const response = await FLW_calls.verifyPayment(payload);
    const resp = response.data;
    console.log(resp);
    if (response) {
      //save to transaction collection
      const newTransaction = new TransactionModel({
        paymentlinkId: transaction._id,
        receiverId: transaction.receiverid,
        txid: resp.txid,
        txref,
        newtxref: resp.txref,
        txtype: txtype,
        amount: resp.amount,
        chargedAmount: resp.chargedamount,
        transactionCharge: resp.appfee,
        amountSettled: resp.amountsettledforthistransaction,
        pplamountSettled: calcPPLCharge2(resp.chargedamount),
        ip: resp.ip,
        narration: resp.narration,
        status: resp.status,
        paymenttype: resp.paymenttype,
        paymentid: resp.paymentid,
        created: resp.created,
        customerId: resp.customerid,
        customerPhone: resp.custphone,
        customerName: resp.custname,
        customerEmail: resp.custemail,
        customerCreated: resp.custcreated,
        cardType: resp.card.type,
        raveRef: resp.raveref,
        settlementdate
      });
      const savedTransaction = await newTransaction.save();

      let paymentStatus = resp.status,
        chargeResponsecode = resp.chargecode,
        chargeAmount = resp.amount;

      if (
        (chargeResponsecode == "00" || chargeResponsecode == "0") &&
        chargeAmount == transaction.amount
      ) {
        return savedTransaction;
      } else {
        return false;
      }
    }
    return false;
  },

  makeTitleCase: str => {
    return str
      .toLowerCase()
      .split(" ")
      .map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  },

  runSettlements: async () => {
    //get all merchants to be settled today
    const merchantsToBeSettled = await getMerchantsToBeSettled();
    if (merchantsToBeSettled.length > 0) {
      //get total amount for each merchant
      const settleMerchants = await runSettleMerchants(merchantsToBeSettled);
      return settleMerchants;
      //
    }
  },

  makeTitleCase: str => {
    return str
      .toLowerCase()
      .split(" ")
      .map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  },
  calcInvoiceAmount: (items, discountamount = 0, tax = 0, shippingFee = 0) => {
    let itemAmount = 0;
    items.map(item => {
      itemAmount =
        Number(itemAmount) + Number(item.unitCost) * Number(item.quantity);
    });

    //remove discount
    let amountBeforeDiscount = Number(itemAmount),
      amountAfterDiscount =
        Number(amountBeforeDiscount) - Number(discountamount),
      //add tax
      amountBeforeTax = Number(amountAfterDiscount),
      taxAmount = (Number(tax) / 100) * Number(amountBeforeTax),
      amountAfterTax = Number(amountBeforeTax) + Number(taxAmount),
      //add shipping
      amountBeforeShipping = Number(amountAfterTax),
      amountAfterShipping = Number(amountBeforeShipping) + Number(shippingFee),
      //final amount
      finalAmount = Number(amountAfterShipping);
    return finalAmount;
  },
  runInstantSettlement: async (merchant, transaction) => {
    // let td = new Date();
    // let td = new Date(new Date().setDate(new Date().getDate() + 1));
    // let today = td.setHours(0, 0, 0, 0);
    //get all amount for each user

    let merchantDetail = await TransactionModel.find({
      settlementstatus: { $ne: "settled" },
      receiverId: merchant._id,
      txref: transaction.txref
    }).select("pplamountSettled");
    //sum up all amounts for this user
    let totalAmount = 0;
    if (merchantDetail.length > 0) {
      merchantDetail.map(singleAmount => {
        totalAmount =
          Number(totalAmount) + Number(singleAmount.pplamountSettled);
      });
      totalAmount =
        Number(totalAmount) - Number(process.env.PPLSETTLEMENTCHARGE);
    }
    //get Bank details of User
    let userBankdata = await BankdataModel.findOne({
      userid: merchant._id,
      isprimary: true
    });
    let txref =
      "BTRSF-" +
      Math.random()
        .toString(36)
        .substr(2, 11);
    if (userBankdata) {
      // bankdataPayload = {
      //   Bank: userBankdata.bankcode,
      //   "Account Number": userBankdata.accountnumber,
      //   Amount: Number(totalAmount),
      //   Currency: "NGN",
      //   Narration: `payperless.com transfer to ${userBankdata.accountname}`,
      //   Reference: txref
      // };
      const initiateTransfer = await FLW_calls.singleTransfer(
        userBankdata.accountnumber,
        userBankdata.accountname,
        userBankdata.bankcode,
        totalAmount,
        txref
      );
      if (initiateTransfer.status === "success");
      {
        console.log(
          `NGN${totalAmount} sent to ${userBankdata.accountname} - ${userBankdata.accountnumber} - ${userBankdata.bankcode} with reference ${txref}`
        );
      }
    }

    //  return bankdataPayload;
  }
};
