function Privacy() {
  return (
    <div className="page-shell privacy-page">
      <div className="page-header">
        <h1>Privacy Policy</h1>
        <p>How Backpack handles your notes, Gmail connection and uploaded documents.</p>
      </div>
      <div className="policy-card">
        <section><h3>1. Local-first data</h3><p>Backpack is designed to run on your own computer. Notes are stored in the PostgreSQL database configured by you. Uploaded PDF/Word files are processed by the local Backpack backend and temporary processing files are cleaned up after use.</p></section>
        <section><h3>2. Gmail access</h3><p>Backpack uses Google's Gmail API with readonly access. It reads messages needed for organization and deadline extraction. Backpack does not send, delete, modify or compose Gmail messages.</p></section>
        <section><h3>3. Google credentials</h3><p>Your Google OAuth client credentials and local authorization token stay in the backend configuration on your computer. Do not commit credentials.json, token.json or .env files to GitHub.</p></section>
        <section><h3>4. Email processing</h3><p>Email classification and priority scoring are performed by the Backpack backend. Stored email metadata is kept in your configured database so the inbox can be searched and categorized later.</p></section>
        <section><h3>5. Documents and PDFs</h3><p>Backpack's PDF tools process files through the local backend. Note-to-PDF conversion uses the built-in PDF generator; note contents are not sent to a third-party PDF service.</p></section>
        <section><h3>6. Your responsibility</h3><p>Protect your database, Google OAuth files and environment variables. If you deploy Backpack to a network, configure authentication, HTTPS and a restricted CORS policy before allowing other users to access it.</p></section>
        <section><h3>7. Changes</h3><p>This policy may be updated when Backpack's data handling changes. The copy included with the project describes the current local-development design.</p></section>
      </div>
    </div>
  );
}
export default Privacy;
