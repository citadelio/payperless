const axios = require("axios");

module.exports = {
  resolveBankAccount: async (accountnumber, bankcode) => {
    const accountDetails = await axios.post(
      "https://api.ravepay.co/flwv3-pug/getpaidx/api/resolve_account",
      {
        recipientaccount: accountnumber,
        destbankcode: bankcode,
        PBFPubKey: process.env.FLW_PUBLIC_KEY
      },
      { headers: { "Content-Type": "application/json" } }
    );
    return accountDetails.data;
  },
  createTransferRecipient: async (accountnumber, bankcode) => {
    const recipient = await axios.post(
      "https://api.ravepay.co/v2/gpx/transfers/beneficiaries/create",
      {
        account_number: accountnumber,
        account_bank: bankcode,
        seckey: process.env.FLW_SECRET_KEY
      },
      { headers: { "Content-Type": "application/json" } }
    );
    return recipient.data;
  },
  singleTransfer: async (
    accountnumber,
    accountname,
    bankcode,
    amount,
    txref
  ) => {
    const initiate = await axios.post(
      "https://api.ravepay.co/v2/gpx/transfers/create",
      {
        account_bank: bankcode,
        account_number: accountnumber,
        amount: Number(amount.toFixed(2)),
        beneficiary_name: accountname,
        seckey: process.env.FLW_SECRET_KEY,
        narration: "Settlement from Payperless.com",
        currency: "NGN",
        reference: txref,
        callback_url: `${process.env.DOMAIN}/flutterwave/transfers/callback`
      },
      { headers: { "Content-Type": "application/json" } }
    );
    return initiate.data;
  },
  bulkTransfer: async recipientsArray => {
    //sample array
    // recipientsArray =  [
    //     {
    //       "Bank":"044",
    //       "Account Number": "0690000032",
    //       "Amount":500,
    //       "Currency":"NGN",
    //       "Narration":"Bulk transfer 1",
    //       "Reference": "mk-82973029"
    //   },
    //   {
    //       "Bank":"044",
    //       "Account Number": "0690000034",
    //       "Amount":500,
    //       "Currency":"NGN",
    //       "Narration":"Bulk transfer 2",
    //       "Reference": "mk-283874750"
    //   }
    // ]
    const bulk = await axios.post(
      "https://api.ravepay.co/v2/gpx/transfers/create_bulk",
      {
        seckey: process.env.FLW_SECRET_KEY,
        title: "Settlements",
        bulk_data: recipientsArray
      },
      { headers: { "Content-Type": "application/json" } }
    );
    return bulk.data;
  },
  listTransfers: async (type = null) => {
    let url;
    if (type) {
      url = `https://api.ravepay.co/v2/gpx/transfers?seckey=${process.env.FLW_SECRET_KEY}&status=${type}`;
    } else {
      url = `https://api.ravepay.co/v2/gpx/transfers?seckey=${process.env.FLW_SECRET_KEY}`;
    }
    const transfers = await axios.get(url, {
      headers: { "Content-Type": "application/json" }
    });
    return transfers.data;
  },
  fetchSingleTransfer: async (id, accountnumber, txref) => {
    const singleTransfer = await axios.get(
      `https://api.ravepay.co/v2/gpx/transfers?seckey=${process.env.FLW_SECRET_KEY}&id=${id}&q=${accountnumber}&reference=${txref}`,
      { headers: { "Content-Type": "application/json" } }
    );
    return singleTransfer.data;
  },
  bulkTransferStatus: async batchid => {
    const stat = await axios.get(
      `https://api.ravepay.co/v2/gpx/transfers?seckey=${process.env.FLW_SECRET_KEY}&batch_id=${batchid}`,
      { headers: { "Content-Type": "application/json" } }
    );
    return stat.data;
  },
  getTransferFee: async () => {
    const fee = await axios.get(
      `https://api.ravepay.co/v2/gpx/transfers/fee?seckey=${process.env.FLW_SECRET_KEY}&currency=NGN`,
      { headers: { "Content-Type": "application/json" } }
    );
    return fee.data;
  },
  getAllBanks: async () => {
    const allBanks = await axios.get(
      `https://api.ravepay.co/v2/banks/NG?public_key=${process.env.FLW_PUBLIC_KEY}`,
      { headers: { "content-type": "application/json" } }
    );
    return allBanks.data;
  },
  initiatePayment: async payload => {
    const paymentResponse = await axios.post(
      "https://api.ravepay.co/flwv3-pug/getpaidx/api/v2/hosted/pay",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "cache-control": "no-cache"
        }
      }
    );
    return paymentResponse.data;
  },
  verifyPayment: async payload => {
    const response = await axios.post(
      "https://api.ravepay.co/flwv3-pug/getpaidx/api/v2/verify",
      payload,
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-cache"
        }
      }
    );
    return response.data;
  }
};
