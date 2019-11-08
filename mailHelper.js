const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
exports.send = (email, templateId) => {
  const msg = {
    to: email,
    from: "Naka <naka@getdispatch.co>",
    templateId,
    dynamic_template_data: {}
  };

  try {
    sgMail.send(msg);
  } catch (err) {
    console.log(err);
  }
};
