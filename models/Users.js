const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
    min: 6
  },
  paymentlink: {
    type: String
  },
  customerreceipt: {
    type: Boolean,
    default: true
  },
  userreceipt: {
    type: Boolean,
    default: true
  },
  settlementtype: {
    type: String,
    default: "next-day"
  },
  created: {
    type: Date,
    default: Date.now
  },
  activated: {
    type: Boolean,
    default: false
  },
  modified: {
    type: Date,
    default: Date.now
  }
});

module.exports = User = mongoose.model("user", UserSchema);
