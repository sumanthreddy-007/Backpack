# Backpack Privacy Policy

Backpack is designed as a local-first student productivity application. Notes are stored in the PostgreSQL database configured by the user. Gmail is accessed through Google's Gmail API with readonly scope. Backpack does not send, delete, edit, or compose Gmail messages.

Local OAuth credentials (`credentials.json` and `token.json`), database credentials, and environment variables must be kept private and must not be committed to source control.

PDF and document processing is performed by the local Backpack backend. Note-to-PDF export uses Backpack's built-in ReportLab PDF generation rather than a third-party document conversion service.

If Backpack is deployed to other users or exposed beyond the local machine, the deployment owner should add authentication, HTTPS, access controls, restricted CORS, and appropriate data-retention procedures.
