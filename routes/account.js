const router = require("express").Router();
const protectRoute = require("../middleware/auth");
const { check, validationResult } = require("express-validator");

const BiodataModel = require("../models/Biodata");
const BankdataModel = require("../models/Bankdata");
const InvoiceModel = require("../models/Invoices");
const UserModel = require("../models/Users");
const AllbanksModel = require("../models/Allbanks");
const TransactionModel = require("../models/Transactions");

const helperFunctions = require("../middleware/helperFunctions");
const FLW_calls = require("../middleware/FLW_calls");

//Send mail
const sendEmail = require("../middleware/sendEmail");

router.get("/get/biodata", protectRoute, async (req, res) => {
  const userid = req.userid;
  const biodata = await BiodataModel.findOne({ userid });
  if (biodata) {
    return res.status(200).json({ biodata, status: true });
  } else {
    return res.json({ status: false });
  }
});

router.get("/get/bankdetails", protectRoute, async (req, res) => {
  const userid = req.userid;
  try {
    const bankdetails = await BankdataModel.findOne({
      userid,
      isprimary: true
    });
    if (bankdetails) {
      return res.status(200).json({ bankdetails, status: true });
    } else {
      return res.json({ status: false });
    }
  } catch (err) {
    return res.json({
      errors: [
        {
          msg: "An error occured, Refresh the page"
        }
      ],
      status: "E"
    });
  }
});

router.get("/get/allbankdetails", protectRoute, async (req, res) => {
  const userid = req.userid;
  try {
    const bankdetails = await BankdataModel.find({ userid });
    if (bankdetails.length > 0) {
      return res.status(200).json({ bankdetails, status: true });
    } else {
      return res.json({ status: false });
    }
  } catch (err) {
    return res.json({
      errors: [
        {
          msg: "An error occured, Refresh the page"
        }
      ],
      status: "E"
    });
  }
});

router.get("/get/user", protectRoute, async (req, res) => {
  const userid = req.userid;
  const userdetails = await UserModel.findById(userid);
  if (userdetails) {
    return res.status(200).json({ userdetails, status: true });
  } else {
    return res.json({ status: false });
  }
});

router.get("/payment/get/user/:id", async (req, res) => {
  const userid = req.params.id;
  const userdetails = await UserModel.findById(userid);
  if (!userdetails) {
    return res.json({
      errors: [
        {
          msg: "User not found"
        }
      ]
    });
  }
  return res.status(200).json({ userdetails, status: true });
});

router.get("/get/transactions/all", protectRoute, async (req, res) => {
  const userid = req.userid;
  console.log(userid);
  try {
    const transactions = await TransactionModel.find({
      receiverId: userid
    }).sort({ created: -1 });

    if (!transactions) {
      return res.json({
        errors: [
          {
            msg: "An error occured, Refresh the page"
          }
        ],
        status: "E"
      });
    }
    res.status(200).json({ transactions, status: true });
  } catch (err) {
    return res.json({
      errors: [
        {
          msg: "An error occured, Refresh the page"
        }
      ],
      status: "E"
    });
  }
});

router.get("/transaction/details/:receiverId/:txref", async (req, res) => {
  const { receiverId, txref } = req.params;
  const transactionDetails = await TransactionModel.findOne({
    receiverId,
    txref
  });
  if (!transactionDetails) {
    return res.json({
      errors: [
        {
          msg: "No transaction record found"
        }
      ]
    });
  }
  return res.status(200).json({ transactionDetails, status: true });
});
router.post(
  "/create/biodata",
  protectRoute,
  [
    check("firstname")
      .not()
      .isEmpty(),
    check("lastname")
      .not()
      .isEmpty(),
    check("phone")
      .not()
      .isEmpty()
      .isLength({ min: 11 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    const { firstname, lastname, phone, address, city, state } = req.body;
    const userid = req.userid;
    const biodata = new BiodataModel({
      userid,
      firstname,
      lastname,
      phone,
      address,
      city,
      state
    });

    biodata
      .save()
      .then(async () => {
        const user = await UserModel.findById(userid);
        //send welcome mail
        const from = '"PAYPERLESS.com" <customersuccess@payperless.com>';
        const subject = "Welcome to PAYPERLESS";
        const welcomeEmailTemplate = require("../middleware/Emails/welcome");
        const messageBody = welcomeEmailTemplate(user);
        const emailSent = await sendEmail(
          from,
          user.email,
          subject,
          messageBody
        ).catch(console.error);

        return res.status(200).json({ biodata });
      })
      .catch(err => {
        return res.json({
          errors: [
            {
              msg: "Unable to save user data"
            }
          ]
        });
      });
  }
);

router.post(
  "/edit/biodata",
  protectRoute,
  [
    check("firstname")
      .not()
      .isEmpty(),
    check("lastname")
      .not()
      .isEmpty(),
    check("phone")
      .not()
      .isEmpty()
      .isLength({ min: 11 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    const { firstname, lastname, phone, address, city, state } = req.body;
    const userid = req.userid;
    const biodata = await BiodataModel.updateOne(
      { userid },
      {
        firstname,
        lastname,
        phone,
        address,
        city,
        state,
        modified: new Date()
      }
    );
    if (biodata.n > 0) {
      return res
        .status(201)
        .json({ status: true, msg: "User details updated" });
    } else {
      return res.json({
        errors: [
          {
            msg: "An error occured while updating user details. Try again"
          }
        ]
      });
    }
  }
);

router.post(
  "/edit/businessdata",
  protectRoute,
  [
    check("businessname")
      .not()
      .isEmpty(),
    check("state")
      .not()
      .isEmpty(),
    check("city")
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    const {
      businessname,
      sector,
      description,
      address,
      city,
      state
    } = req.body;
    const userid = req.userid;
    const biodata = await BiodataModel.updateOne(
      { userid },
      {
        address,
        city,
        state,
        sector,
        description,
        modified: new Date()
      }
    );
    if (biodata.n > 0) {
      const changeBusinessname = await UserModel.updateOne(
        { _id: userid },
        {
          name: businessname,
          modified: new Date()
        }
      );

      if (changeBusinessname.n > 0) {
        return res
          .status(201)
          .json({ status: true, msg: "Business details updated" });
      } else {
        return res.json({
          errors: [
            {
              msg: "An error occured while updating Business details. Try again"
            }
          ]
        });
      }
    } else {
      return res.json({
        errors: [
          {
            msg: "An error occured while updating user details. Try again"
          }
        ]
      });
    }
  }
);

router.post(
  "/create/bank",
  protectRoute,
  [
    check("bankcode")
      .not()
      .isEmpty(),
    check("accountname")
      .not()
      .isEmpty(),
    check("accountnumber")
      .not()
      .isEmpty()
      .isLength({ min: 10 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    const {
      bankcode,
      accountname,
      accountnumber,
      isprimary = false
    } = req.body;
    console.log(req.body);
    const userid = req.userid;
    //if the new account has been set as primary, set all previous account as secondary
    if (isprimary) {
      //get all bank accounts belongig to this user
      try {
        const prevBanks = await BankdataModel.find({ userid });
        if (prevBanks) {
          prevBanks.map(async prevbank => {
            await BankdataModel.update(
              { _id: prevbank._id },
              { isprimary: false }
            );
          });
        }

        //end
      } catch (err) {
        console.log(err);
      }
    }

    //save new one
    const bankdata = new BankdataModel({
      userid,
      bankcode,
      accountname,
      isprimary: isprimary || false,
      accountnumber
    });

    bankdata
      .save()
      .then(() => {
        return res.status(200).json({ bankdata });
      })
      .catch(err => {
        return res.json({
          errors: [
            {
              msg: "Unable to save user data"
            }
          ]
        });
      });
  }
);

router.post(
  "/edit/bank/:id",
  protectRoute,
  [
    check("bankcode")
      .not()
      .isEmpty(),
    check("accountname")
      .not()
      .isEmpty(),
    check("accountnumber")
      .not()
      .isEmpty()
      .isLength({ min: 10 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    const { bankcode, accountname, accountnumber, isprimary } = req.body;
    const userid = req.userid;
    const bankdataId = req.params.id;

    //if the new account has been set as primary, set all previous account as secondary
    if (isprimary) {
      //get all bank accounts belongig to this user
      try {
        const prevBanks = await BankdataModel.find({ userid });
        if (prevBanks) {
          prevBanks.map(async prevbank => {
            await BankdataModel.update(
              { _id: prevbank._id },
              { isprimary: false }
            );
          });
        }
        //end
      } catch (err) {
        console.log(err);
      }
    }

    const bankdata = await BankdataModel.updateOne(
      { userid, _id: bankdataId },
      {
        bankcode,
        accountname,
        accountnumber,
        isprimary,
        modified: new Date()
      }
    );
    if (bankdata.n > 0) {
      return res.status(201).json({ msg: "User details updated" });
    } else {
      return res.json({
        errors: [
          {
            msg: "An error occured while updating user details. Try again"
          }
        ]
      });
    }
  }
);

router.get("/get/invoice/completed", protectRoute, async (req, res) => {
  const userid = req.userid;
  const invoice = await InvoiceModel.find({
    receiverid: userid,
    amount: { $gte: 1 }
  });

  if (!invoice) {
    return res.json({
      errors: [
        {
          msg: "No Invoice found, Kindly create one"
        }
      ]
    });
  }
  res.status(200).json({ invoice });
});

router.get("/get/invoice/all", protectRoute, async (req, res) => {
  const userid = req.userid;
  const invoice = await InvoiceModel.find({ receiverid: userid });

  if (!invoice) {
    return res.json({
      errors: [
        {
          msg: "No Invoice found, Kindly create one"
        }
      ]
    });
  }
  res.status(200).json({ invoice });
});

router.post(
  "/create/invoice",
  protectRoute,
  [
    check("invoicetype")
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    const userid = req.userid;
    let txref =
        "INV-" +
        Math.random()
          .toString(36)
          .substr(2, 11),
      paymentlink = process.env.DOMAIN + "/pay-invoice/" + txref;

    const invoice = new InvoiceModel({
      txref,
      newtxref: txref,
      invoiceType: req.body.invoicetype,
      receiverid: userid,
      paymentlink: paymentlink
    });

    const saveInvoice = await invoice.save();
    if (!saveInvoice) {
      return res.json({
        errors: [
          {
            msg: "An error occured while creating invoice. Try again"
          }
        ]
      });
    }
    return res
      .status(201)
      .json({ status: "OK", msg: "Invoice created", invoice: saveInvoice });
  }
);

router.post(
  "/edit/invoice/:id",
  protectRoute,
  [
    check("items")
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    const userid = req.userid;
    const {
      email,
      firstname,
      lastname,
      phone,
      description,
      invoiceNumber,
      dueDate,
      tax,
      discount,
      shippingFee,
      paymentstatus,
      forwardstatus,
      items
    } = req.body;
    let amount = helperFunctions.calcInvoiceAmount(
      items,
      discount,
      tax,
      shippingFee
    );

    if (Array.isArray(amount)) {
      amount = parseFloat(amount[amount.length - 1]);
    } else {
      amount = parseFloat(amount);
    }

    const invoice = await InvoiceModel.updateOne(
      { _id: req.params.id, receiverid: userid },
      {
        customer: {
          email,
          firstname,
          lastname,
          phone
        },
        amount,
        description,
        invoiceNumber,
        dueDate,
        tax,
        discount,
        shippingFee,
        items,
        paymentstatus,
        forwardstatus
      }
    );

    if (invoice.n > 0) {
      if (forwardstatus === "save-only") {
        return res
          .status(201)
          .json({ status: true, msg: "Invoice updated", type: "save-only" });
      }
      if (forwardstatus === "save-and-send" || forwardstatus === "send") {
        //get Business Details
        const businessDetails = await UserModel.findById(userid);
        const invoiceDetails = await InvoiceModel.findOne({
          _id: req.params.id,
          receiverid: userid
        });

        //Send mail
        const sendEmail = require("../middleware/sendEmail");
        const from = '"Payperless.com" <invoices@payperless.com>';
        const subject =
          "New invoice from " +
          helperFunctions.makeTitleCase(businessDetails.name);
        const invoiceEmailTemplate = require("../middleware/Emails/invoice");
        const messageBody = invoiceEmailTemplate(
          businessDetails,
          invoiceDetails
        );
        sendEmail(
          from,
          invoiceDetails.customer.email,
          subject,
          messageBody
        ).catch(console.error);

        //update invoice sentcount and lastsent
        const updateinvoice = await InvoiceModel.updateOne(
          { _id: req.params.id, receiverid: userid },
          {
            sentcount: invoiceDetails.sentcount + 1,
            lastsent: new Date()
          }
        );

        return res.status(201).json({
          status: true,
          msg: "Invoice updated",
          type: "save-and-send"
        });
      }
    } else {
      return res.json({
        errors: [
          {
            msg: "An error occured while updating invoice. Try again",
            err: invoice
          }
        ]
      });
    }
  }
);

router.post("/delete/invoice/:id", protectRoute, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.json({ errors: errors.array() });
  }
  const userid = req.userid;
  //Check if Invoice exist
  const invoiceDetails = await InvoiceModel.findOne({
    _id: req.params.id,
    receiverid: userid
  });

  //if invoice exist, delete it
  if (invoiceDetails) {
    const deleted = await InvoiceModel.deleteOne({
      _id: req.params.id,
      receiverid: userid
    });
    return res.status(200).json(deleted);
  } else {
    return res.json({
      errors: [
        {
          msg: "Invoice does not exist"
        }
      ]
    });
  }
});

router.post("/mark-as-paid/invoice/:id", protectRoute, async (req, res) => {
  // const errors = validationResult(req);
  // if (!errors.isEmpty()) {
  //   return res.json({ errors: errors.array() });
  // }
  const userid = req.userid;
  //Check if Invoice exist
  const invoiceDetails = await InvoiceModel.findOne({
    _id: req.params.id,
    receiverid: userid
  });

  //if invoice exist,mark it as paid
  if (invoiceDetails) {
    const updateInv = await InvoiceModel.updateOne(
      {
        _id: req.params.id,
        receiverid: userid
      },
      {
        paymentstatus: "successful"
      }
    );

    if (updateInv.n > 0) {
      return res
        .status(201)
        .json({ status: true, msg: "Invoice has been updated" });
    } else {
      return res.json({
        errors: [
          {
            msg: "An error occured while updating invoice. Try again"
          }
        ]
      });
    }
  } else {
    return res.json({
      errors: [
        {
          msg: "Invoice does not exist"
        }
      ]
    });
  }
});

router.post("/verifyaccount", async (req, res) => {
  const { accountnumber, bankcode } = req.body;
  console.log(bankcode);
  try {
    const bankDetails = await FLW_calls.resolveBankAccount(
      accountnumber,
      bankcode
    );
    res.status(200).json(bankDetails);
  } catch (err) {
    return res.json({
      errors: [
        {
          err,
          msg: "Unable to resolve bank details. Try again"
        }
      ]
    });
  }
});

router.get("/allbanks", async (req, res) => {
  try {
    const resp = await AllbanksModel.find();
    console.log(resp);
    if (resp) {
      res.status(200).json(resp[0].banks);
    } else {
      return res.json({
        errors: [
          {
            err,
            msg: "Could not get all banks"
          }
        ]
      });
    }
  } catch (err) {
    return res.json({
      errors: [
        {
          err,
          msg: "Could not get all banks"
        }
      ]
    });
  }
});

router.post("/edit/settings", protectRoute, async (req, res) => {
  const userid = req.userid;
  const { settlementtype, userreceipt, customerreceipt } = req.body;
  const updateSettings = await UserModel.updateOne(
    {
      _id: userid
    },
    {
      settlementtype,
      userreceipt,
      customerreceipt
    }
  );

  if (updateSettings.n > 0) {
    return res
      .status(201)
      .json({ status: true, msg: "Settings has been updated" });
  } else {
    return res.json({
      errors: [
        {
          msg: "An error occured while updating settings. Try again"
        }
      ]
    });
  }
});

module.exports = router;
