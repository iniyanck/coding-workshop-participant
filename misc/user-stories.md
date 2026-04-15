# ACME TeamHub — User Story Diagrams

## US-1: User Authentication

> *As a user, I want to log in with my credentials so that I can access the team management platform.*

```mermaid
sequenceDiagram
    actor User
    participant Login as 🔐 Login Page
    participant Auth as ⚡ Auth Service
    participant DB as 🐘 PostgreSQL
    participant App as 📊 Dashboard

    User->>Login: Opens app (localhost:3000)
    Login->>Login: Redirect to /login<br/>(no token found)
    User->>Login: Enters username + password
    Login->>Login: Client-side validation
    Login->>Auth: POST /api/auth-service<br/>{action: "login", username, password}
    Auth->>DB: SELECT FROM users<br/>WHERE username = ?
    DB-->>Auth: User row (with hash)
    Auth->>Auth: Verify password<br/>(SHA-256 + salt)

    alt Valid Credentials
        Auth->>Auth: Generate JWT<br/>(24h expiry)
        Auth-->>Login: 200 {token, user}
        Login->>Login: Store in localStorage
        Login->>App: Navigate to /
        App->>App: Load dashboard data
    else Invalid Credentials
        Auth-->>Login: 401 "Invalid username or password"
        Login->>User: Show error alert
    end
```

## US-2: New User Registration

> *As a new user, I want to register an account so that I can start using the platform.*

```mermaid
sequenceDiagram
    actor User
    participant Reg as 📝 Register Tab
    participant Auth as ⚡ Auth Service
    participant DB as 🐘 PostgreSQL

    User->>Reg: Click "Register" tab
    User->>Reg: Fill username, email, password
    Reg->>Reg: Client-side validation<br/>(required fields, email format)
    Reg->>Auth: POST /api/auth-service<br/>{action: "register", ...}
    Auth->>Auth: Validate input<br/>(min lengths, format)

    alt Validation Failed
        Auth-->>Reg: 400 {error, details}
        Reg->>User: Show field errors
    else Username/Email Taken
        Auth->>DB: Check uniqueness
        DB-->>Auth: Conflict
        Auth-->>Reg: 400 "Username already exists"
    else Success
        Auth->>Auth: Hash password
        Auth->>DB: INSERT INTO users
        DB-->>Auth: New user row
        Auth->>Auth: Generate JWT
        Auth-->>Reg: 201 {token, user}
        Reg->>User: Redirect to dashboard
    end
```

## US-3: Managing Team Members (CRUD)

> *As a manager, I want to add, edit, and remove team members so that I can keep our roster up to date.*

```mermaid
stateDiagram-v2
    [*] --> IndividualsPage: Navigate to /individuals

    IndividualsPage --> ViewList: Load all individuals
    ViewList --> SearchFilter: Search or filter by team
    SearchFilter --> ViewList: Results updated

    ViewList --> AddDialog: Click "Add Individual"
    AddDialog --> FillForm: Enter details
    FillForm --> Validate: Submit
    Validate --> FillForm: Errors shown
    Validate --> SaveCreate: Valid
    SaveCreate --> ViewList: Refresh list + snackbar

    ViewList --> EditDialog: Click ✏️ edit icon
    EditDialog --> FillEditForm: Modify fields
    FillEditForm --> ValidateEdit: Submit
    ValidateEdit --> FillEditForm: Errors shown
    ValidateEdit --> SaveUpdate: Valid
    SaveUpdate --> ViewList: Refresh list + snackbar

    ViewList --> ConfirmDelete: Click 🗑️ delete icon
    ConfirmDelete --> ViewList: Cancel
    ConfirmDelete --> ExecuteDelete: Confirm
    ExecuteDelete --> ViewList: Refresh list + snackbar

    note right of AddDialog: Only visible to<br/>admin, manager,<br/>contributor roles
    note right of ConfirmDelete: Only visible to<br/>admin, manager roles
```

## US-4: Team Structure Management

> *As an admin, I want to create teams, assign leaders, and track org structure so that I can manage the organization hierarchy.*

```mermaid
sequenceDiagram
    actor Admin
    participant Teams as 📋 Teams Page
    participant TS as ⚡ Teams Service
    participant IS as ⚡ Individuals Service
    participant DB as 🐘 PostgreSQL

    Admin->>Teams: Navigate to /teams
    Teams->>TS: GET /api/teams-service
    Teams->>IS: GET /api/individuals-service
    TS-->>Teams: Teams list (with member_count)
    IS-->>Teams: Individuals list

    Admin->>Teams: Click "Add Team"
    Teams->>Teams: Open dialog with<br/>leader/org leader dropdowns<br/>(populated from individuals)
    Admin->>Teams: Fill name, location,<br/>select leader from dropdown
    Teams->>TS: POST /api/teams-service<br/>{name, location, leader_id}
    TS->>DB: INSERT INTO teams
    DB-->>TS: New team
    TS-->>Teams: 201 Created
    Teams->>Admin: Show success snackbar

    Note over Admin,DB: Assign Members
    Admin->>Teams: Navigate to /individuals
    Admin->>Teams: Edit individual → select team
    Teams->>IS: PUT /api/individuals-service/:id<br/>{team_id: "<team-uuid>"}
    IS->>DB: UPDATE individuals SET team_id
    DB-->>IS: Updated
    IS-->>Teams: 200 OK
```

## US-5: Tracking Achievements

> *As a contributor, I want to record team achievements so that we can track our progress over time.*

```mermaid
flowchart TB
    subgraph UserAction["👤 Contributor Actions"]
        Nav["Navigate to Achievements"]
        View["View all achievements"]
        Filter["Filter by team"]
        Create["Add new achievement"]
        Update["Edit achievement"]
    end

    subgraph Form["📝 Achievement Form"]
        Title["Title (required)"]
        Desc["Description"]
        Team["Team (dropdown)"]
        Date["Date (date picker)"]
    end

    subgraph API["⚡ Backend"]
        Post["POST /api/achievements-service"]
        Get["GET /api/achievements-service"]
        GetFilter["GET ?team_id=..."]
        Put["PUT /api/achievements-service/:id"]
    end

    subgraph DB["💾 Database"]
        Insert["INSERT INTO achievements"]
        Select["SELECT with JOIN teams"]
        UpdateQ["UPDATE achievements"]
    end

    Nav --> View
    View --> Get --> Select
    View --> Filter --> GetFilter --> Select
    View --> Create --> Form
    Form --> Post --> Insert
    View --> Update --> Form
    Form --> Put --> UpdateQ

    style UserAction fill:#e0e7ff,stroke:#6366f1
    style Form fill:#fef3c7,stroke:#d97706
    style API fill:#dcfce7,stroke:#16a34a
    style DB fill:#dbeafe,stroke:#2563eb
```

## US-6: Dashboard Business Insights

> *As a manager, I want to see key metrics about our organization so I can make data-driven decisions.*

```mermaid
flowchart TB
    subgraph DataLoad["📊 Dashboard Data Loading"]
        D1["GET /api/teams-service"]
        D2["GET /api/individuals-service"]
        D3["GET /api/achievements-service"]
    end

    subgraph Compute["🧮 Computed Metrics"]
        M1["Total Individuals"]
        M2["Total Teams"]
        M3["Total Achievements"]
        M4["Unique Locations"]
    end

    subgraph Insights["💡 Business Insights"]
        I1["Teams with remote leaders<br/>(leader.location ≠ team.location)"]
        I2["Teams with non-direct staff leaders<br/>(leader.is_direct_staff = false)"]
        I3["Teams with >20% non-direct ratio<br/>(non_direct / total > 0.2)"]
        I4["Teams reporting to org leader<br/>(org_leader_id IS NOT NULL)"]
    end

    subgraph Display["🖥️ Dashboard Cards"]
        C1["📈 Stat Cards"]
        C2["📋 Key Insights Panel"]
        C3["🏆 Recent Achievements"]
    end

    D1 & D2 & D3 --> M1 & M2 & M3 & M4
    D1 & D2 --> I1 & I2 & I3 & I4
    M1 & M2 & M3 & M4 --> C1
    I1 & I2 & I3 & I4 --> C2
    D3 --> C3

    style DataLoad fill:#dbeafe,stroke:#2563eb
    style Compute fill:#dcfce7,stroke:#16a34a
    style Insights fill:#fef3c7,stroke:#d97706
    style Display fill:#f3e8ff,stroke:#7c3aed
```

## US-7: Role-Based Access Control

> *As an admin, I want to control what each user role can do so that data integrity is maintained.*

```mermaid
flowchart LR
    subgraph Roles["User Roles"]
        Admin["🔴 Admin"]
        Manager["🟡 Manager"]
        Contributor["🔵 Contributor"]
        Viewer["⚪ Viewer"]
    end

    subgraph Permissions["Allowed Actions"]
        ManageUsers["Manage Users & Roles"]
        DeleteRecords["Delete Records"]
        CreateUpdate["Create & Update Records"]
        ReadData["Read All Data"]
    end

    Admin --> ManageUsers
    Admin --> DeleteRecords
    Admin --> CreateUpdate
    Admin --> ReadData

    Manager --> DeleteRecords
    Manager --> CreateUpdate
    Manager --> ReadData

    Contributor --> CreateUpdate
    Contributor --> ReadData

    Viewer --> ReadData

    style Admin fill:#fef2f2,stroke:#ef4444,color:#000
    style Manager fill:#fffbeb,stroke:#f59e0b,color:#000
    style Contributor fill:#eff6ff,stroke:#3b82f6,color:#000
    style Viewer fill:#f3f4f6,stroke:#6b7280,color:#000
    style ManageUsers fill:#fee2e2,stroke:#dc2626
    style DeleteRecords fill:#fef3c7,stroke:#d97706
    style CreateUpdate fill:#dbeafe,stroke:#2563eb
    style ReadData fill:#dcfce7,stroke:#16a34a
```

## US-8: Admin User Management

> *As an admin, I want to manage user accounts and change roles so that I can control access.*

```mermaid
sequenceDiagram
    actor Admin
    participant Page as 👥 Users Page
    participant Auth as ⚡ Auth Service
    participant DB as 🐘 PostgreSQL

    Admin->>Page: Navigate to /users
    Page->>Auth: GET /api/auth-service<br/>Authorization: Bearer <admin-token>
    Auth->>Auth: Verify JWT + role = admin
    Auth->>DB: SELECT all users
    DB-->>Auth: User list (no passwords)
    Auth-->>Page: 200 [{id, username, email, role}]
    Page->>Admin: Render user table

    Note over Admin,DB: Change Role
    Admin->>Page: Change role dropdown<br/>(viewer → contributor)
    Page->>Auth: PUT /api/auth-service/:userId<br/>{role: "contributor"}
    Auth->>Auth: Verify admin role
    Auth->>DB: UPDATE users SET role = ?
    DB-->>Auth: Updated user
    Auth-->>Page: 200 OK
    Page->>Admin: Show "Role updated" snackbar

    Note over Admin,DB: Delete User
    Admin->>Page: Click 🗑️ on user row
    Page->>Page: Confirm dialog
    Admin->>Page: Confirm delete
    Page->>Auth: DELETE /api/auth-service/:userId
    Auth->>Auth: Verify admin role
    Auth->>Auth: Prevent self-delete
    Auth->>DB: DELETE FROM users
    DB-->>Auth: Deleted
    Auth-->>Page: 204 No Content
    Page->>Admin: Refresh table
```
