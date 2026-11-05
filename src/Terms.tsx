/** Terms of use and privacy notice. Plain language; shown without signing in at #/terms. */
export default function Terms() {
  return (
    <div className="page terms">
      <div className="page-head">
        <h1>Terms and privacy</h1>
        <p className="sub">Job Agent is a private, invite-only tool run by one person for friends. It is not a company or a commercial service.</p>
      </div>
      <article className="panel prose">
        <h2>What it does</h2>
        <p>Job Agent finds roles on official company job boards (Ashby, Greenhouse, Lever), filters them with your preferences, scores how well they fit your resume,
          fills in application forms using only the details and answers you confirmed, and, in automatic mode or after you approve, submits them for you.</p>

        <h2>You are responsible for your answers</h2>
        <ul>
          <li>Every fact it types comes from what you confirmed, your resume, or a standing answer you chose. It does not guess. A required question it can’t answer is held for you.</li>
          <li>Short written answers may be drafted from your resume by an AI model. In review mode you see them before anything is sent; in automatic mode they are sent without review.</li>
          <li>Applications are sent in your name. Check your details and standing answers. They are treated as true.</li>
        </ul>

        <h2>Limits and risks</h2>
        <ul>
          <li>Some job sites’ terms don’t allow automated applications. Using Job Agent is your choice.</li>
          <li>It never solves or gets around CAPTCHAs or other checks. When one appears it stops and hands the application to you.</li>
          <li>It never contacts recruiters or companies other than by submitting the application form.</li>
          <li>When a site shows no confirmation, it can’t know whether the application arrived. Those are marked “not confirmed” and never retried.</li>
          <li>There is no guarantee of results, availability or accuracy.</li>
        </ul>

        <h2>What is stored, and where</h2>
        <ul>
          <li>Your resume PDF, confirmed details, standing answers, preferences, drafts, form screenshots, run history and the list of applications sent, in a private Google Cloud project (Firestore and Cloud Storage, US).</li>
          <li>Your resume text and job descriptions are sent to OpenAI to score fit and draft short answers. The admin pays for this.</li>
          <li>Summary emails are sent to your Google sign-in address from the admin’s Gmail account. You can turn them off in Preferences.</li>
          <li>The admin sees your name, email, and counts (applications sent, held, failed; searches run).</li>
          <li>During these early weeks the admin can also see a decision log for each of your searches: which jobs passed your filters, each job’s fit score and the scorer’s
            explanation (which refers to your resume), the requirements it found met or missing, and why an application was held. This is to check the agent works properly.
            The admin does not see your form answers, contact details, resume file or screenshots.</li>
          <li>Logs record events and IDs, not your answers or contact details, and are kept for 30 days.</li>
        </ul>

        <h2>Your data, your choice</h2>
        <p>Under Setup → Your data you can download everything stored about you, or delete it. Deleting removes your resume, details, answers, preferences, drafts, screenshots and run history.
          The list of companies and roles already applied to is kept so the agent never applies to the same posting twice. Applications already sent can’t be withdrawn by Job Agent.</p>
        <p className="hint">Last updated 5 November 2026 (admin decision log added).</p>
      </article>
      <p><a className="btn btn-quiet" href="#/" onClick={e => { e.preventDefault(); history.pushState(null, '', location.pathname + location.search); dispatchEvent(new HashChangeEvent('hashchange')) }}>Back to Job Agent</a></p>
    </div>
  )
}
