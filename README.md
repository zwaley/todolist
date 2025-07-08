# TodoList - A Collaborative Task Management App

This is a [Next.js](https://nextjs.org) application for managing personal and team-based todos. It uses [Supabase](https://supabase.io) for the backend, including database and user authentication.

## Core Features

The application is designed to be more than just a personal todo list. It includes a team-based collaboration system.

- **User Authentication**: Secure user registration and login via email and password.
- **Personal Todos**: Users can create, view, update, and delete their own private todos.
- **Team Collaboration**:
  - Users can create and name their own teams. Team names are unique across the application.
  - Team creators can invite other users to join their teams using a shareable invite code.
  - Todos can be shared within a team, allowing all team members to view and interact with them.
- **Task Management**:
  - Todos have a status (e.g., `incomplete`, `completed`) to track progress.
  - Real-time updates for shared todos within a team.

## Technical Design & Architecture

- **Frontend**: [Next.js](https://nextjs.org) with [React](https://react.dev/) and [Tailwind CSS](https://tailwindcss.com/).
- **Backend**: [Supabase](https://supabase.io)
  - **Database**: PostgreSQL for data storage.
  - **Authentication**: Supabase Auth for managing users.
  - **Security**: Row Level Security (RLS) is enforced on all tables to ensure users can only access their own data or data from teams they are a member of.

### Database Schema

1.  **`teams`**: Stores information about each team.
    - `id`: Unique identifier for the team.
    - `name`: The name of the team (must be unique).
    - `created_by`: The user who created the team.
    - `invite_code`: (Optional) A unique code for inviting new members to the team.

2.  **`team_members`**: Manages the many-to-many relationship between users and teams.
    - `team_id`: Foreign key to the `teams` table.
    - `user_id`: Foreign key to the `auth.users` table.

3.  **`todos`**: Stores the actual todo items.
    - `id`: Unique identifier for the todo.
    - `user_id`: The user who created the todo.
    - `task`: The content of the todo item.
    - `is_completed`: Boolean flag to mark the todo as complete or not.
    - `team_id`: (Optional) Foreign key to the `teams` table. If `NULL`, the todo is private. If set, it's shared with the specified team.

*Note: The `auth.users` table, managed by Supabase Auth, is implicitly referenced by `created_by` in `teams` and `user_id` in `team_members` and `todos`.*

## Development Roadmap

1.  **Setup Supabase**:
    - [x] Finalize database schema.
    - [ ] Create `teams`, `team_members`, and `todos` tables in Supabase.
    - [ ] Implement Row Level Security (RLS) policies for all tables.
2.  **Implement Core Todo Features**:
    - [ ] Display a list of private and shared todos on the main page.
    - [ ] Create a form to add new todos (with an option to make them private or share with a team).
    - [ ] Add functionality to mark todos as complete.
    - [ ] Add functionality to delete todos.
3.  **Implement Team Management**:
    - [ ] Create a UI for users to create new teams.
    - [ ] Develop a system for inviting members to a team.

## Getting Started

First, set up your Supabase project and configure the environment variables.

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.