var aws = require("aws-sdk"),
    config = require("config"),
    MailParser = require("mailparser").MailParser,
    nodemailer = require('nodemailer'),
    sesTransport = require('nodemailer-ses-transport'),
    util = require('util');

var s3 = new aws.S3({ apiVersion: '2006-03-01' });

function forwardMail(mail){
  // create reusable transporter object using the default SMTP transport
  var transport = nodemailer.createTransport(sesTransport({
      accessKeyId: config.awsKey,
      secretAccessKey: config.awsSecret,
      rateLimit: 5 // do not send more than 5 messages in a second
  }));

  // NB! No need to recreate the transporter object. You can use
  // the same transporter object for all e-mails

  // setup e-mail data with unicode symbols
  var mailOptions = {
      from: config.from + ' <' + config.from + '>', // sender address
      to: config.to, // list of receivers
      subject: mail.subject, // Subject line
      text: mail.text, // plaintext body
      html: mail.html // html body
  };

  // send mail with defined transport object
  transporter.sendMail(mailOptions, function(error, info){
      if(error){
          return console.log(error);
      }
      console.log('Message sent: ' + info.response);

  });
};

exports.handler = function(event, context) {
  // Get the object from the event and show its content type
  var bucket = event.Records[0].s3.bucket.name;
  var key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  var params = { Bucket: bucket, Key: key };
  var mailparser = new MailParser();

  mailparser.on("end", function(mail){
    forwardMail(mail)
      .then(function(){
        context.succeed("Parsed mail");
      }).catch(function(message){
        context.fail(message);
      });
  });

  console.log("Handling %s", key);

  try {
    s3.getObject(params, function(err, data) {
      if (err) {
        console.log(err);
        var message = "Error getting object " + key + " from bucket " + bucket +
            ". Make sure they exist and your bucket is in the same region as this function.";
        console.log(message);
        context.fail(message);
      }
    }).on('httpData', function(chunk){
      mailparser.write(chunk);
    }).on('httpDone', function(){
      mailparser.end();
    });

  } catch (e) {
    console.log("Caught Error:");
    context.fail(e.message);
  }
};