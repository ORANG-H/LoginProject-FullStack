# Full-Stack Advice App & Dashboard

A secure, full-stack web application featuring user authentication, cloud database integration, and a dynamic dashboard that fetches data from an external API.

## Features
* **User Authentication:** Secure registration and login using `bcrypt` password hashing and session management.
* **Personalized Dashboard:** Users can manage their profiles, upload custom avatars (handled via `multer`), and interact with customized content.
* **API Integration:** Fetches and displays dynamic data points using the API Ninjas network.
* **Saved Favorites:** Users can save their favorite quotes to a relational database table and manage their customized lists.

## Tech Stack
* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL (hosted on Supabase), `pg` module
* **Frontend:** EJS (Embedded JavaScript templates), HTML5, CSS3
* **Security & Environment:** `bcrypt`, `express-session`, `dotenv`

## Installation & Local Setup
To run this project locally, you will need Node.js and a PostgreSQL database.

1. Clone the repository:
   ```bash
   git clone [https://github.com/ORANG-H/LoginProject-FullStack.git](https://github.com/ORANG-H/LoginProject-FullStack.git)
