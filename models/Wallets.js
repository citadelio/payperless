const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const WalletSchema = new Schema({
  receiverid: String,
  paymentid:String,
  transactionid:String,
  txamount:Number,
  txtype:String,
  balance:Number,
  created:{
      type:Date,
      default:Date.now
  }
});


module.exports = Wallet = mongoose.model('wallet', WalletSchema);