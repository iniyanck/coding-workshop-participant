# ACME TeamHub

ACME TeamHub is a centralized Human Resource Information System (HRIS) and team management platform designed to provide a comprehensive view of organizational dynamics, employee performance, and skill development.

## 🚀 Key Features

- **People Management**: Centralized directory of employees with role-based visibility and profile management.
- **Team Insights**: Visualize team structures, physical locations via interactive maps, and leadership hierarchies.
- **Skill Gap Analysis**: Advanced analytics to identify proficiency levels and organizational training needs.
- **Achievements & Awards**: A catalog for recognizing individual and team-level milestones (e.g., Hackathon wins, certifications).
- **Development Planning**: Structured growth tracks for employees, including senior transition and training plans.
- **Multi-Role Dashboards**: Tailored experiences for Employees, Managers, HR Business Partners, and Administrators.
- **HRIS Console**: Administrative tools for direct data management and system configuration.

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 19
- **UI Library**: Material UI (MUI) with custom Glassmorphism/Dark Mode support
- **Analytics**: Recharts for data visualization
- **Maps**: MapLibre GL for deterministic grid-based location tracking
- **State Management**: React Context API

### Backend
- **Language**: Python
- **Architecture**: Microservices (Auth, Individuals, Teams, Skills, Achievements, DevPlans, Notifications)
- **Database**: PostgreSQL
- **Serverless**: Targeted for AWS Lambda deployment

### Infrastructure
- **IaaS**: Terraform
- **Cloud Services**: AWS (S3, CloudFront, Route53, Lambda, RDS)

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.9+
- PostgreSQL (for local backend development)

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd coding-workshop-participant
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Backend Setup**:
   Each service in `backend/` contains its own requirements and logic. Refer to the specific service READMEs for details.

4. **Start Development Environment**:
   Use the provided helper scripts:
   ```bash
   ./bin/start-dev.sh
   ```

## 📬 Contact & Feedback

For questions, feedback, or suggestions, please reach out to:
**Iniyan C Kalai** - [iniyanckalai@gmail.com](mailto:iniyanckalai@gmail.com)

---
*Developed as part of the ACME Inc. Organizational Transformation.*
