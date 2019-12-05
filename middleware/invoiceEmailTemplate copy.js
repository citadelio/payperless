const helperFunctions = require("./helperFunctions");

module.exports = (businessDetails, invoiceDetails) => {
  return `<p>Hello ${helperFunctions.makeTitleCase(
    invoiceDetails.customer.firstname
  )},</p>
      <p>
      ${helperFunctions.makeTitleCase(
        businessDetails.name
      )} just sent you an invoice of ${helperFunctions.prettyCurrency(
    invoiceDetails.amount
  )}.
      </p>
      <p> <a href="${
        invoiceDetails.paymentlink
      }">Click Here</a> to view and pay this invoice</p>
      <p> if the link above is not clickable, copy and paste this link to your browser to view and pay this invoice ${
        invoiceDetails.paymentlink
      }</p>
      <p>
      If you have any questions about this invoice, please email ${helperFunctions.makeTitleCase(
        businessDetails.name
      )} at ${businessDetails.email}
      </p>
      <p>
      © PAYperless HQ ${new Date().getFullYear()}  Professional Payments for Small Businesses
      </p>`;
};
