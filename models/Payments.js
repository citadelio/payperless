const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
  receiverid: {
    type: String,
    required: true
  },
  senderfirstname: { type: String, required: true },
  senderlastname: { type: String, required: true },
  senderemail: { type: String },
  senderphone: { type: String },
  paymenttype: { type: String, required: true },
  paymentlink: { type: String },
  txref: { type: String },
  flwref: { type: String },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    default: Date.now
  }
});

module.exports = Payment = mongoose.model("payment", PaymentSchema);
