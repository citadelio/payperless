const nodemailer = require("nodemailer");
module.exports = async (from, receiver, subject, body) => {
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.EmailUser,
      pass: process.env.EmailPassword
    }
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: from,
    to: receiver,
    subject: subject,
    // text: "Hello world?", // plain text body
    html: body // html body
  });
  // console.log(info)
  if (info.Error) {
    return false;
  } else if (info.accepted.length > 0) {
    return info;
  }
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
};
