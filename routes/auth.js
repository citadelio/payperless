const router = require("express").Router();
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const protectedRoute = require("../middleware/auth");

//Models
const UserModel = require("../models/Users");
const Activation = require("../models/Activation");
const Reset = require("../models/Passwordreset");
//Send mail
const sendEmail = require("../middleware/sendEmail");
const activationEmailTemplate = require("../middleware/Emails/activation");

//generate payment link
const generatePaymentLink = (businessname, retry) => {
  let domain = process.env.DOMAIN,
    link,
    bname;
  if (!retry) {
    bname = businessname.split(" ")["0"].toLowerCase();
  } else {
    bname =
      businessname.split(" ")["0"].toLowerCase() +
      (Math.floor(Math.random() * 100) + 10);
  }
  link = domain + "/pay/" + bname;
  return link;
};

router.get("/validate-token", protectedRoute, (req, res) => {
  res.json({ status: true, userid: req.userid });
});
router.post(
  "/login",
  [check("email").isEmail(), check("password").isLength({ min: 6 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    const { email, password } = req.body;

    //Check if user exist
    let user = await UserModel.findOne({ email });

    if (!user) {
      return res.json({
        errors: [
          {
            statuscode: "E1",
            msg: "This email/password is incorrect"
          }
        ]
      });
    }
    //compare passwords to see if it matches
    match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json({
        errors: [
          {
            statuscode: "E1",
            msg: "This email/password is incorrect"
          }
        ]
      });
    }
    let token = jwt.sign({ userid: user.id }, process.env.jwtSecret, {
      expiresIn: 3600
    });
    return res
      .status(200)
      .cookie("X-AUTH-TOKEN", token, {
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true
      })
      .json({ token, statuscode: "S1" });
  }
);

/*
# method       POST
# route         /auth/register
*/
router.post(
  "/register",
  [
    check("email").isEmail(),
    check("password").isLength({ min: 6 }),
    check("businessname")
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ errors: errors.array() });
    }
    const { businessname, email, password } = req.body;

    //Check for already existing email
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.json({
        errors: [
          {
            msg: "This email has already been used"
          }
        ]
      });
    }

    // if (password !== confirmpassword) {
    //   return res.status(400).json({
    //     errors: [
    //       {
    //         msg: "Passwords do not match"
    //       }
    //     ]
    //   });
    // }

    //generate payment link
    let paymentlink;
    paymentlink = generatePaymentLink(businessname);
    //Check DB if link exist
    let exist = await UserModel.findOne({ paymentlink });
    if (exist) {
      paymentlink = generatePaymentLink(businessname, true);
    }
    //Initialize a new User
    const user = new UserModel({
      name: businessname,
      email,
      password,
      paymentlink
    });

    //Encrypt password
    let salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    //Save new User
    user.save();

    //generate and save activation link
    const hash = crypto
      .createHmac("sha256", "random-secret")
      .update(new Date().valueOf().toString())
      .digest("hex");

    let now = new Date();
    let expiry = now.setHours(now.getHours() + 1);

    const activationLink = new Activation({
      expiry,
      userid: user.id,
      code: hash
    });

    activationLink.save();

    //send activation mail to user
    const from = '"Payperless.com" <activation@payperless.com>';
    const subject = "Activate your Payperless account";
    const messageBody = activationEmailTemplate(user, activationLink);
    const emailSent = await sendEmail(
      from,
      user.email,
      subject,
      messageBody
    ).catch(console.error);
    //Generate token
    const token = jwt.sign({ userid: user.id }, process.env.jwtSecret, {
      expiresIn: 3600
    });

    //return token
    return res.status(200).json({ token, emailSent });
  }
);

router.get("/send-activation", protectedRoute, async (req, res) => {
  const userid = req.userid;
  const user = await UserModel.findById(userid);
  if (!user) {
    return res.json({ status: false });
  }

  //generate and save activation link
  const hash = crypto
    .createHmac("sha256", "random-secret")
    .update(new Date().valueOf().toString())
    .digest("hex");

  let now = new Date();
  let expiry = now.setHours(now.getHours() + 1);

  const activationLink = new Activation({
    expiry,
    userid: user.id,
    code: hash
  });

  activationLink.save();

  //send activation mail to user
  const from = '"Payperless.com" <activation@payperless.com>';
  const subject = "Activate your Payperless account";
  const messageBody = activationEmailTemplate(user, activationLink);
  const emailSent = await sendEmail(
    from,
    user.email,
    subject,
    messageBody
  ).catch(console.error);
  console.log(emailSent);
  return res.status(200).json({ emailSent });
});

router.get("/activate-account/:code", async (req, res) => {
  //check if code is still valid
  const activationDetails = await Activation.findOne({ code: req.params.code });
  if (!activationDetails) {
    return res.json({
      errors: [
        {
          msg: "Activation code is invalid"
        }
      ]
    });
  }

  if (new Date() > activationDetails.expiry) {
    return res.json({
      errors: [
        {
          msg: "Activation link is expired"
        }
      ]
    });
  }

  const userid = activationDetails.userid;
  const user = await UserModel.updateOne({ _id: userid }, { activated: true });
  if (user.n > 0) {
    return res.status(201).json({ success: [{ msg: "Account activated" }] });
  } else {
    return res.json({
      errors: [
        {
          msg: "An error occured while activating account. Try again"
        }
      ]
    });
  }
});

router.post(
  "/forgot-password",
  [
    check("email")
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.json({ errors: errors.array() });
    }

    //check if email exist
    let user = await UserModel.findOne({ email: req.body.email });
    if (!user) {
      return res.json({
        errors: [
          {
            msg: "This email does not exist on our database"
          }
        ]
      });
    }

    //generate and save reset link
    const hash = crypto
      .createHmac("sha256", "random-secret")
      .update(new Date().valueOf().toString())
      .digest("hex");

    let now = new Date();
    let expiry = now.setHours(now.getHours() + 1);

    const resetPasswordLink = new Reset({
      expiry,
      userid: user.id,
      email: req.body.email,
      code: hash
    });

    const savedResetDetails = await resetPasswordLink.save();

    //send reset email to user
    const from = '"Payperless.com" <activation@payperless.com>';
    const subject = "Reset your Payperless password";
    const resetPasswordEmailTemplate = require("../middleware/Emails/resetpassword");
    const messageBody = resetPasswordEmailTemplate(
      user,
      savedResetDetails,
      req.header("User-Agent")
    );
    const emailSent = sendEmail(from, user.email, subject, messageBody).catch(
      console.error
    );

    return res
      .status(200)
      .json({ success: [{ msg: "Reset link sent to email" }] });
  }
);

router.get("/reset-password/:code", async (req, res) => {
  //check the code
  const resetDetails = await Reset.findOne({ code: req.params.code });
  if (!resetDetails) {
    return res.json({
      errors: [
        {
          msg: "Reset code is invalid"
        }
      ]
    });
  }
  return res.status(200).json({ success: [{ resetDetails }] });
});

router.post(
  "/reset-password/:code",
  [
    check("password")
      .not()
      .isEmpty()
      .isLength({ min: 6 }),
    check("confirmpassword")
      .not()
      .isEmpty()
      .isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.json({ errors: errors.array() });
    }

    const resetDetails = await Reset.findOne({ code: req.params.code });
    if (!resetDetails) {
      return res.json({
        errors: [
          {
            msg: "Reset code is invalid"
          }
        ]
      });
    }

    const { password, confirmpassword } = req.body;
    //check if passwords match
    if (password !== confirmpassword) {
      return res.json({
        errors: [
          {
            msg: "Passwords do not match"
          }
        ]
      });
    }
    //Encrypt password
    let salt = await bcrypt.genSalt(10),
      hashedpassword = await bcrypt.hash(password, salt);
    //update user detail
    const updatedUser = await UserModel.updateOne(
      { _id: resetDetails.userid },
      {
        password: hashedpassword
      }
    );
    if (updatedUser.n > 0) {
      res.status(200).json({
        success: [
          { msg: "Password has been changed, Kindly sign in to continue." }
        ]
      });
    } else {
      return res.json({
        errors: [
          {
            msg: "Couldn't update user details, Try again."
          }
        ]
      });
    }
  }
);

router.post(
  "/change-password",
  [
    check("oldpassword")
      .not()
      .isEmpty()
      .isLength({ min: 6 }),
    check("password")
      .not()
      .isEmpty()
      .isLength({ min: 6 }),
    check("confirmpassword")
      .not()
      .isEmpty()
      .isLength({ min: 6 })
  ],
  protectedRoute,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.json({ errors: errors.array() });
    }

    const userid = req.userid;
    const { oldpassword, password, confirmpassword } = req.body;
    //get user's current password
    const user = await UserModel.findOne({ _id: userid });
         //check to see if old password is correct
      const comparePasswords = await bcrypt.compare(oldpassword, user.password);
      console.log(comparePasswords)
      if(!comparePasswords){
        return res.json({
          errors: [
            {
              msg: "The password you entered is incorrect"
            }
          ]
        });
      }
    //check if passwords match
    if (password !== confirmpassword) {
      return res.json({
        errors: [
          {
            msg: "New passwords do not match"
          }
        ]
      });
    }
    //Encrypt password
    let salt = await bcrypt.genSalt(10),
      hashedpassword = await bcrypt.hash(password, salt);
    //update user detail
    const updatedUser = await UserModel.updateOne(
      { _id: userid },
      {
        password: hashedpassword
      }
    );
    if (updatedUser.n > 0) {
      res.status(200).json({
        msg: "Password has been changed, Kindly sign in to continue.",
        status: true
      });
    } else {
      return res.json({
        errors: [
          {
            msg: "Couldn't update user details, Try again."
          }
        ]
      });
    }
  }
);

router.get("/testclient", (req, res) => {
  return res.json({ msg: "Hello from this side" });
});
module.exports = router;
