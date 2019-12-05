const express = require("express");
const dotenv = require("dotenv");
// const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path")
const app = express();
dotenv.config();

mongoose
  .connect(process.env.DBConnect, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  })
  .then(() => console.log("DB Connected"))
  .catch(error => console.log("could not connect", error));

const CronJobs = require("./middleware/cronjobs");

if (process.env.NODE_ENV === "production") {
  app.use(express.static("build"));
}

// app.use(morgan("combined"));
app.use(express.json({ extended: false }));
app.use("/auth", require("./routes/auth"));
app.use("/account", require("./routes/account"));
app.use("/users", require("./routes/users"));
app.use("/pay", require("./routes/paymentlink"));
app.use("/pay-invoice", require("./routes/invoicepayment"));
app.use("/administrator/backend", require("./routes/adminRoute"));
app.use("/flutterwave", require("./routes/flutterwave"));

// Run CronJobs
CronJobs.dailySettlementJob();
app.get('/*', (req, res)=> {
  res.sendFile(path.join(__dirname, 'build/index.html'), (err)=> {
    if (err) {
      res.status(500).send(err)
    }
  })
})

app.listen(process.env.PORT || 5000, () =>
  console.log(`Server started on port ${process.env.PORT}`)
);
