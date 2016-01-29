var path = require('path');
var config = require('config');
var EmailTemplate = require('email-templates').EmailTemplate;
var fs = require('fs');
var ejs = require('ejs');
var sendgrid  = require('sendgrid')(config.EMAIL.SENDGRID_API_KEY);

/**
 * Send mail
 * @param  {Object}   locals       Recipient address, message and other template specific values
 * @param  {String}   templateName The name of the mail and subject template
 * @param  {Function} callback
 */
function sendMail(locals, templateName, callback) {
    var templatesDir = path.resolve(__dirname, '..', 'template/mail-body');
    var template = new EmailTemplate(path.join(templatesDir, templateName));

    // Retrieve template and send mail
    template.render(locals, function (err, results) {
        if (err) {
            return callback(err);
        }

        sendgrid.send({
            from: config.EMAIL.FROM,
            to: locals.email,
            subject: ejs.render(fs.readFileSync(path.join(__dirname,
                '../template/mail-subject/' + templateName + '.ejs'), 'utf-8'), locals),
            html: results.html,
            text: results.text
        }, callback());
    });
}

module.exports = {
    sendMail: sendMail
};
