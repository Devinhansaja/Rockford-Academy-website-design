/*
 * CMS stand-in for the static concept.
 * In WordPress these values come from the rockford-core plugin
 * (Site Settings + rf_programme / rf_vacancy / rf_testimonial post types).
 *
 * RULE: only confirmed information goes here. Empty values hide the related UI.
 */
window.RF_DATA = {
  settings: {
    // Fill in once confirmed by Rockford Academy. Leave null to hide.
    address: null,        // "No. 00, Street, City, Sri Lanka"
    phone: null,          // "+94 00 000 0000"
    whatsapp: null,       // international format, digits only: "94700000000"
    email: null,          // "info@…" (only once the domain and mailbox exist)
    careersEmail: null,
    social: [],           // [{ label: "Instagram", url: "https://…" }]
    programmeFilterThreshold: 4,
    expressionOfInterestApproved: false // management approval for the general EOI form
  },

  programmes: [],   // none confirmed yet → Coming Soon state
  vacancies: [],    // none published yet → careers fallback
  testimonials: [], // none approved yet → section hidden

  /*
   * TEMPORARY STOCK PHOTOS for the design preview only.
   * Source: Unsplash (free to use under the Unsplash License, https://unsplash.com/license).
   * They do NOT show Rockford Academy, its students or facilities, and must be
   * replaced with authentic Rockford photography before launch. Set any value
   * to null to fall back to the neutral placeholder.
   */
  images: {
    hero:       { src: "https://images.unsplash.com/photo-1571260899304-425eee4c7efc", alt: "A young woman holding textbooks in a bright classroom with other students" },
    journey1:   { src: "https://images.unsplash.com/photo-1686624386665-4cd01b96d0f6", alt: "Young men working together and writing notes at a table" },
    journey2:   { src: "https://images.unsplash.com/photo-1712903911017-7c10a3c4b3e5", alt: "A young woman presenting ideas on a board to her group" },
    journey3:   { src: "https://images.unsplash.com/photo-1637073849563-5b0ac780ec34", alt: "A presenter speaking to a small group in a meeting room" },
    difference: { src: "https://images.unsplash.com/photo-1549057446-9f5c6ac91a04", alt: "A group of young adults walking and laughing together outdoors" },
    programmes: { src: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846", alt: "Friends sitting together on a bench outdoors, smiling" }
  },

  gallery: [
    { label: "Classrooms", brief: "Small-group room, natural light, learners facing each other",
      img: { src: "https://images.unsplash.com/photo-1758270704763-22072a90d3b6", alt: "Students talking and laughing in a lecture hall" } },
    { label: "Collaborative spaces", brief: "Breakout tables, whiteboards, active discussion",
      img: { src: "https://images.unsplash.com/photo-1682962232755-f1d051ddb638", alt: "A group of young people laughing around a wooden table" } },
    { label: "Presentation studio", brief: "Learner presenting to peers, trainer observing",
      img: { src: "https://images.unsplash.com/photo-1715610258704-e8f9f5710fe0", alt: "A young woman speaking into a microphone in front of an audience" } },
    { label: "Workshops", brief: "Hands-on activity, movement, energy",
      img: { src: "https://images.unsplash.com/photo-1758270705317-3ef6142d306f", alt: "Students gathered around a laptop working on a task together" } },
    { label: "Academy facilities", brief: "Reception and common areas, architectural detail" },
    { label: "Student activities", brief: "Debate, role-play or team challenge" }
  ]
};

/*
 * SAMPLE DATA: loaded only with ?demo=1 so reviewers can see the card layouts.
 * Clearly labelled on screen. Never published.
 */
window.RF_SAMPLE = {
  programmes: [
    { title: "Sample programme A", excerpt: "Placeholder description showing how a two-line programme summary sits within the card.", audience: "School leavers", duration: "Sample: 12 weeks", format: "In person", category: "Communication", availability: "enrolling" },
    { title: "Sample programme B", excerpt: "Placeholder description showing a slightly longer summary that wraps across three lines in the layout.", audience: "Young adults", duration: "Sample: 8 weeks", format: "Blended", category: "Workplace readiness", availability: "coming_soon" },
    { title: "Sample programme C", excerpt: "Placeholder description for layout review only.", audience: "Young professionals", duration: "Sample: 6 weekends", format: "In person", category: "Confidence", availability: "waitlist" },
    { title: "Sample programme D", excerpt: "Placeholder description for layout review only.", audience: "Higher-education aspirants", duration: "Sample: 10 weeks", format: "Online", category: "Communication", availability: "enrolling" }
  ],
  vacancies: [
    { title: "Sample role: English & communication trainer", type: "Full-time", category: "Teaching", deadline: "Sample date" },
    { title: "Sample role: Personal development facilitator", type: "Part-time", category: "Teaching", deadline: "Sample date" },
    { title: "Sample role: Academy coordinator", type: "Full-time", category: "Operations", deadline: "Sample date" }
  ]
};
