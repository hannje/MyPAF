# PAF Management System - Codebase Architecture Guide

## Overview

This is a **PAF (Postal Address File) Management System** built as a full-stack web application with mobile support. PAF is a USPS (United States Postal Service) requirement for organizations that process mail and need NCOA (National Change of Address) services. This system manages the lifecycle of PAF forms, user approvals, and related business processes for service providers and their clients.

## High-Level Architecture

### Technology Stack

**Backend (Node.js/Express)**
- **Runtime**: Node.js with Express.js framework
- **Database**: MySQL with connection pooling (mysql2)
- **Authentication**: Session-based with express-session (cookie-based)
- **Security**: bcryptjs for password hashing, CORS configured for cross-origin requests
- **Email Services**: Nodemailer for automated notifications
- **File Processing**: PDF manipulation with pdf-lib, CSV processing
- **SSL/TLS**: HTTPS server with certificates in `/certs` directory

**Frontend (React)**
- **Framework**: React 19.1.0 with Create React App
- **Routing**: React Router DOM v7.6.0
- **HTTP Client**: Axios with cookie jar support (axios-cookiejar-support)
- **UI Components**: Custom components with CSS modules
- **State Management**: React Context API (AuthContext)
- **Digital Signatures**: react-signature-canvas for PAF form signatures

**Mobile Support**
- **Capacitor**: v7.4.2 for cross-platform mobile deployment
- **Native Builds**: Android and iOS project configurations included
- **React Native**: Alternative mobile implementation in `paf-system-mobile/`

## Directory Structure

### Root Level
```
C:\MyPAFReact\
├── paf-system-backend-node\     # Express.js backend server
├── paf-system-frontend\         # React web application
└── paf-system-mobile\           # React Native mobile app (alternative)
```

### Backend Structure (`paf-system-backend-node/`)
```
├── certs/                       # SSL certificates (cert.pem, key.pem)
├── data/                        # Business documents and reference data
│   ├── PAF_FORM*.pdf           # PAF form templates
│   ├── naics_codes.csv         # NAICS industry classification codes
│   └── *.PDF                   # Sample PAF documents
├── node_modules/               # Dependencies
├── public/signatures/          # Uploaded digital signatures (UUIDs)
├── services/
│   └── emailService.js         # Email notification service
├── server.js                   # Main server application
└── package.json               # Dependencies and scripts
```

### Frontend Structure (`paf-system-frontend/`)
```
├── android/                    # Capacitor Android build
├── ios/                       # Capacitor iOS build
├── build/                     # Production build output
├── public/
│   └── data/                  # Static PAF documents
├── src/
│   ├── api/
│   │   └── apiClient.js       # Axios client with cookie support
│   ├── components/            # React components
│   ├── context/
│   │   └── AuthContext.js     # Authentication state management
│   ├── App.js                 # Main application router
│   ├── AuthPage.js            # Login component
│   └── index.js               # Application entry point
├── capacitor.config.ts        # Capacitor mobile configuration
└── package.json              # Dependencies and scripts
```

## Key Business Domain Concepts

### PAF (Postal Address File)
- Core business entity representing a form submission for USPS NCOA services
- Contains list owner details, signer information, and approval workflow
- States: Draft → Pending Validation → USPS Review → Approved/Rejected
- Associated with NAICS industry codes for business classification

### User Roles
- **ADMIN**: Full system access, can manage users and validate PAFs
- **USER**: Can create and manage PAFs for their organization
- **AGENT**: Can approve PAFs on behalf of organizations

### Parties
- Organizations (companies) that own PAFs
- Each user belongs to a party (company)
- Admins can manage users within their party

## Authentication & Security

### Session-Based Authentication
- **Backend**: Express-session with secure HTTP-only cookies
- **Frontend**: Automatic cookie handling with axios-cookiejar-support
- **Security**: bcryptjs password hashing, CORS protection
- **Session Storage**: In-memory (production should use Redis)

### API Security
- HTTPS enforcement (certificates in `/certs`)
- CORS whitelist for allowed origins
- Session middleware on protected routes
- Role-based authorization (Admin/User middlewares)

## Database Design (Inferred)

Based on code analysis, the system uses these main entities:
- **users**: Authentication and user profile data
- **parties**: Organizations/companies
- **pafs**: PAF form submissions with lifecycle states
- **naics_codes**: Industry classification reference data

## Development Workflow

### Backend Development
```bash
cd paf-system-backend-node
npm install
npm run dev      # Development with nodemon
npm start        # Production
```

### Frontend Development
```bash
cd paf-system-frontend
npm install
npm start        # Development server
npm run build    # Production build
```

### Mobile Development
```bash
cd paf-system-frontend
npm run build
npx cap copy
npx cap open android  # or ios
```

## Environment Configuration

### Backend Environment Variables (.env)
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: MySQL connection
- `SESSION_SECRET`: Session encryption key
- `PORT`, `HTTPS_PORT`: Server ports
- `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`: Email service config

### Frontend Environment Variables (.env)
- `REACT_APP_API_URL`: Backend API endpoint (default: https://10.72.14.19:3443)
- `REACT_APP_VERSION`: Application version display

## Key Integration Points

### Email Notifications
- Automated emails for PAF status changes
- Approval/rejection notifications
- Uses Nodemailer with SMTP configuration

### PDF Processing
- Generate populated PAF forms from templates
- Digital signature embedding
- Export capabilities with pdf-lib

### File Upload Handling
- Signature images stored in `/public/signatures/`
- UUID-based file naming for security
- Static file serving through Express

## Development Guidelines

### Code Organization
- **Components**: Functional React components with hooks
- **State Management**: Context API for global state, local state for components
- **API Calls**: Centralized through apiClient.js
- **Styling**: Component-specific CSS files
- **Error Handling**: Try-catch blocks with user-friendly messages

### Security Considerations
- Never store credentials in code
- Use environment variables for configuration
- Validate all user inputs
- Implement proper session management
- Use HTTPS in production

### Performance Patterns
- Database connection pooling
- Component-level loading states
- Pagination for large data sets
- Lazy loading where appropriate

## Common Development Tasks

### Adding New PAF Fields
1. Update database schema
2. Modify CreatePafForm.js component
3. Update backend validation in server.js
4. Add to ViewPafDetails.js for display

### Adding New User Roles
1. Update authentication middleware in server.js
2. Modify AuthContext.js for role handling
3. Update ProtectedRoute component
4. Add role-specific navigation in App.js

### Email Template Customization
1. Modify emailService.js templates
2. Update email configuration in .env
3. Test with different SMTP providers

## Deployment Considerations

### Production Setup
- Configure proper SSL certificates
- Set up Redis for session storage
- Configure production database
- Set secure environment variables
- Enable production logging

### Mobile Deployment
- Build native apps with Capacitor
- Configure app store metadata
- Test cross-platform compatibility
- Handle device-specific features

This architecture supports a robust PAF management workflow while maintaining scalability and security for enterprise use.