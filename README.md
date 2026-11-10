# Aura Assist — AI Customer Concierge

A polished conversational bot prototype built for an AI Engineer technical assessment. It handles inbound enquiries, collects and validates customer details, asks context-aware follow-up questions, schedules an appointment, and produces a final confirmation.

## Features

- Friendly welcome and guided quick replies
- Branching enquiry flows for consultations, sales, support, and general questions
- Name, phone, and email validation with recovery prompts
- Future-date and time validation
- Review and confirmation step
- Downloadable `.ics` calendar invite and conversation transcript
- Browser speech recognition and spoken bot responses where supported
- Responsive, accessible interface with no backend or build dependencies

## Run locally

Open `dist/index.html` in a browser, or serve the `dist` folder with any static file server.

## Technology

Vanilla HTML, CSS, and JavaScript. The prototype deliberately avoids API keys and backend storage, making it safe to share and simple to review. Browser Web Speech APIs provide the optional voice experience.

## Demo flow

1. Choose **Book a consultation**.
2. Explain what you want to discuss.
3. Enter a name, phone number, and email.
4. Choose **Online video call**.
5. Pick a suggested future date and time.
6. Review and confirm the appointment.
7. Download the calendar invite or transcript.

For the error-handling demo, first enter an invalid phone number or email address and show how Aura recovers.
