const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const InvoiceSchema = new Schema({
  invoiceType: String,
  receiverid: String,
  customer: {
    email: String,
    firstname: String,
    lastname: String,
    phone: String
  },
  amount: Number,
  description: String,
  invoiceNumber: Number,
  dueDate: Date,
  tax: Number,
  discount: Number,
  shippingFee: Number,
  items: [
    {
      uid: Number,
      name: String,
      quantity: Number,
      unitCost: Number
    }
  ],
  created: {
    type: Date,
    default: Date.now
  },
  paymentstatus: {
    type: String,
    default: "pending"
  },
  forwardstatus: {
    type: String
  },
  sentcount: {
    type: Number,
    default: 0
  },
  lastsent: {
    type: Date
  },
  paymentlink: String,
  paidon: Date,
  txref: String,
  newtxref: String,
  flw_paymentlink: String,
  flwref: String
});

module.exports = Invoice = mongoose.model("invoice", InvoiceSchema);
