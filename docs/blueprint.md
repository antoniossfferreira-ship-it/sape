# **App Name**: EduCompetence Flow

## Core Features:

- User Authentication & Profile Management: Allows users to register, log in using email/password via Firebase Authentication, and create their profile including academic background, role, and tenure. Profile data is stored in Firestore.
- Work Context & Competence Self-Assessment: Users can input their current work context (unit, sector, formal role) and self-assess their competency levels (1-3) based on loaded expected competencies. All inputs are saved to Firestore.
- AI-Powered Course Recommendations Tool: The system acts as a tool to identify gaps between expected and current competency levels and provides personalized course recommendations from a predefined catalog based on these gaps. This uses stored competency data and course information.
- Recommendation Interaction & Feedback: Displays the generated course recommendations clearly, showing competency, expected/current levels, and allowing users to provide 'like' or 'dislike' feedback, which is recorded in Firestore to refine the system.
- Completed Courses & Certificate Upload: Users can record courses they have completed, including attaching a PDF certificate, and manage their history of professional development. Data is stored in Firestore.
- Researcher Administration Dashboard: Provides a dedicated view for researchers to list all study participants and export their data for analysis, facilitating academic research and system evaluation.

## Style Guidelines:

- Primary color: A deep, professional blue (#3C50A6) symbolizing trust, intelligence, and stability, ideal for an academic institution. It's assertive enough to be a key interaction color without being overly bold.
- Background color: A very light, subtle grey with a hint of the primary blue (#F1F3F8). This provides a clean, open, and professional canvas, enhancing readability and minimizing visual fatigue, perfect for data entry and reading reports.
- Accent color: A vibrant, clear blue (#45ACE6) positioned as analogous to the primary. This color is used for calls to action, highlights, and important information, ensuring strong contrast and guiding user attention without clashing with the primary aesthetic.
- Body and headline font: 'Inter' (sans-serif) provides a modern, neutral, and highly readable typeface suitable for all elements within an academic application, ensuring clarity for forms, instructions, and data displays.
- Use a consistent set of line-art icons that are simple, clear, and universally recognizable to guide users through the various forms, assessments, and administrative sections without visual clutter.
- Implement a clean, structured, and responsive layout with generous whitespace. Prioritize intuitive navigation and accessible form designs, especially for multi-step assessments, to ensure ease of use for all university staff.
- Incorporate subtle feedback animations for user interactions, such as form submissions, toggles, and saving data, providing a sense of responsiveness and completion without being distracting.