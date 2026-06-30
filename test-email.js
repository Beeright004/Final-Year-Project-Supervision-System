import nodemailer from "nodemailer";

async function testEmail() {
  console.log("Testing email configuration...");
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "beeright004@gmail.com",
        pass: "pgdqeqepkiyxbjdz"
      }
    });

    await transporter.verify();
    console.log("SMTP Connection successful!");

    const info = await transporter.sendMail({
      from: '"Test Script" <beeright004@gmail.com>',
      to: "beeright004@gmail.com", // sending to self
      subject: "Test Email from Local Setup",
      text: "This is a test to see if the SMTP credentials are valid."
    });

    console.log("Email sent successfully: ", info.messageId);
  } catch (error) {
    console.error("Failed to send email: ", error);
  }
}

testEmail();
