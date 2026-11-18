# Admin guide for Rockford staff

Sign in at **`https://<your-domain>/admin`**. You only see the sections your role allows.

| Role | Can manage |
|---|---|
| Admin | Everything, including Website Settings, users and the audit log |
| Editor | Programmes, News & Articles, Testimonials, Media Library, enquiries and *Website Pages* (homepage text, images, legal pages) |
| Recruiter | Vacancies and job applications (including CV downloads) |

**Turn on two-factor authentication** in *My account*: scan or type the secret into an authenticator app and confirm with a 6-digit code.

## Everyday tasks

> **Admin scope.** By default (`ADMIN_SCOPE=jobs`) the admin manages only **Vacancies** and **Job Flyers**: add, publish/unpublish and remove. The sections below for programmes, news, applications, settings and users are hidden and blocked. Set `ADMIN_SCOPE=full` in the server `.env` to bring them all back.

### Publish a programme
1. *Programmes → New programme*.
2. Fill in only confirmed information. Empty fields are simply not shown on the website (nothing says "TBC").
3. **Body**, **entry requirements** and **schedule** use simple formatting:
   `## Heading`, `- bullet`, `**bold**`, `[link text](https://…)`.
4. **Learning objectives:** one per line.
5. **Availability:** Coming soon / Now enrolling / Waitlist open / Enrolment closed.
6. Set **Status → Published** and save. The page appears at `/programmes/<slug>` and on the homepage.
7. Filters on the Programmes page appear automatically once there are 4 or more programmes (configurable).

### Advertise a vacancy
1. *Vacancies → New vacancy*; add description, responsibilities and qualifications (one per line), type, location and closing date.
2. Set **Status → Open**. The role appears on the homepage and Careers page, with an online application form.
3. After the closing date the form closes automatically. Use **Close** or **Archive** to take it down sooner.

### Add a job flyer
Job flyers appear in a **Job flyers** section on the Careers page. Admins and recruiters can manage them under *Job Flyers*.
1. *Job Flyers → Add flyer* and choose the type:
   - **Image**: upload the finished flyer (JPG, PNG or WebP). Add alt text that says what the flyer says.
   - **PDF**: upload a PDF. Visitors can open or download it.
   - **Words only**: type the job details (basic formatting is supported) and the website lays them out.
2. Add a title and an optional short description. Optionally set a **closing date**; the flyer is hidden automatically after it.
3. Set **Status → Published** to show it. **Unpublish** takes it down without deleting it; **Delete** also removes the uploaded file.
4. Duplicates are blocked: you cannot add two flyers with the same title, or upload the same file twice. Edit the existing flyer instead.
5. Files can be up to 8 MB (`FLYER_MAX_MB`). Use *Sort order* to control the order (lower first).

### Review applications
1. *Applications* lists the newest first. Search by name, email, position or reference, and filter by vacancy or status.
2. Open an application to read it, **download the CV**, set the status (Received → Reviewing → Shortlisted / Unsuccessful / Hired) and add internal notes.
3. CVs are private. Never forward them outside the recruitment team. Delete an application when the applicant asks, or let the retention period remove it automatically.

### Enquiries
*Enquiries* holds every contact-form and programme enquiry. Reply by email, then mark it **In progress** or **Closed**.

### News & testimonials
- *News & Articles:* write, add an image from the Media Library, publish.
- *Testimonials* are only shown when **written consent** is ticked and **Approved by** is filled in. Never publish invented or edited quotes.

### Images
1. *Media Library → Upload* (JPG, PNG or WebP; please resize to about 2000px wide first).
2. Always write **alt text** describing the image for people who cannot see it.
3. Copy the image URL into a programme, article or *Website Settings → Images*. For security, images must come from the Media Library (`/uploads/…`). Links to images on other websites are not accepted.
4. In *Website Settings → Images*, untick **temporary stock photo** once a real Rockford photo replaces a stock one. Stock photos show a small "Illustrative photo" label.

### Website settings (admins)
- **Contact:** only confirmed details. Empty fields are hidden everywhere (footer, Contact page, WhatsApp buttons, structured data).
- **Notifications:** who receives new enquiries and applications.
- **Homepage copy:** every headline and paragraph on the homepage.
- **Legal pages:** privacy policy and terms (Markdown).
- **Recruitment & privacy:** how many days applications and enquiries are kept; whether the general "expression of interest" form is shown (needs management approval).
- **Analytics & SEO:** GA4 / GTM IDs, Search Console verification, default description, social sharing image.

### Users
*Users & Permissions* (admins): add staff with the least-privileged role they need, reset passwords, remove access when someone leaves. Every change is recorded in the *Audit log*.

## The dashboard checklist
The dashboard lists anything still to do before or after launch, such as email delivery not configured, missing contact details, draft legal pages, stock photos still in use, and admins without 2FA. Work through it until it is clear.

## Getting help
- Website not loading: the hosting provider or developer should check the service (`systemctl status rockford`).
- Restore from backup: see BACKUP-RESTORE.md.
