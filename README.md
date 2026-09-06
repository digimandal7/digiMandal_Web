# DigiMandal Backend - Complete API Implementation

A complete backend solution for the DigiMandal application with 31 APIs, complete OTP authentication, mandal management, invitation system with automatic activation, member management, and document handling with ImageKit integration.

---

## 🎯 CORE FEATURE: Mandal Activation

**Mandals become ACTIVE automatically when:**

1. Owner sends invitations to 5 different users
2. All 5 users accept their invitations
3. On the 5th acceptance → Mandal status changes from DRAFT to ACTIVE


## ⚡ QUICK START

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
PORT=3000
DATABASE_URL="mysql://root:password@localhost:3306/digimandal"
JWT_SECRET="your-secret-key-here"
IMAGEKIT_PUBLIC_KEY="your-public-key"
IMAGEKIT_PRIVATE_KEY="your-private-key"
IMAGEKIT_URL_ENDPOINT="your-url-endpoint"
```

### 3. Setup Database

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start Server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

---

## 📚 DOCUMENTATION FILES

| File                          | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| **API_DOCUMENTATION.md**      | Complete API reference with all 31 endpoints |
| **IMPLEMENTATION_SUMMARY.md** | Feature overview and database changes        |
| **TESTING_GUIDE.md**          | Step-by-step testing with curl examples      |
| **QUICK_REFERENCE.md**        | Quick API lookup card                        |
| **FILE_STRUCTURE.md**         | Complete file structure and changes          |
| **POSTMAN_COLLECTION.json**   | Ready-to-import Postman collection           |

---

## 🚀 API ENDPOINTS OVERVIEW

### Authentication (4 APIs)

```
POST   /api/auth/send-otp
POST   /api/auth/verify-otp
GET    /api/auth/me
GET    /api/auth/verify-token
```

### Mandal Management (9 APIs)

```
POST   /api/mandal
GET    /api/mandal/my-mandals/list
GET    /api/mandal/my-memberships/list
GET    /api/mandal/:id
PUT    /api/mandal/:id
DELETE /api/mandal/:id
POST   /api/mandal/:id/address
POST   /api/mandal/:id/bank-details
POST   /api/mandal/:id/registration
```

### Invitation System (7 APIs)

```
POST   /api/invitation/:mandalId/send
GET    /api/invitation/:mandalId/list
GET    /api/invitation/my/pending
POST   /api/invitation/:invitationId/accept    ← ACTIVATION TRIGGER
POST   /api/invitation/:invitationId/reject
DELETE /api/invitation/:invitationId/cancel
POST   /api/invitation/:invitationId/resend
```

### Member Management (7 APIs)

```
POST   /api/members
GET    /api/members/:mandalId/list
GET    /api/members/:id/details
PUT    /api/members/:id/role
GET    /api/members/:mandalId/status
DELETE /api/members/:id
POST   /api/members/:mandalId/leave
```

### Document Management (4 APIs)

```
POST   /api/documents/upload
GET    /api/documents/:mandalId/list
GET    /api/documents/:id/details
DELETE /api/documents/:id
```

---

## 🔄 COMPLETE USER FLOW

### Step 1: User A Creates Mandal

```bash
POST /api/mandal
{
  "name": "Shri Krishna Mandal",
  "category": "Cultural"
}
```

**Result:** Mandal created with status `DRAFT`

### Step 2: User A Sends 5 Invitations

```bash
POST /api/invitation/1/send
{
  "mobile": "987654****",
  "role": "Coordinator"
}
# Repeat 5 times with different mobiles
```

**Result:** 5 pending invitations sent

### Step 3: Users B-F Accept Invitations

```bash
POST /api/invitation/1/accept     # User B
POST /api/invitation/2/accept     # User C
POST /api/invitation/3/accept     # User D
POST /api/invitation/4/accept     # User E
POST /api/invitation/5/accept     # User F ← THIS ACTIVATES MANDAL!
```

**Result on 5th Acceptance:**

- `mandalActivated: true`
- Mandal status → `ACTIVE`
- All 5 users added as members
- Mandal stays ACTIVE forever

---

## 💾 DATABASE MODELS

```
User
├── id, mobile (unique), isVerified
├── mandalsOwned[] (created mandals)
├── invitations[] (sent invitations)
└── memberships[] (member of mandals)

Mandal
├── id, name, category, size, formationYear
├── status: DRAFT | INVITED | ACTIVE
├── isPrivate, createdById
├── address (MandalAddress)
├── bank (MandalBank)
├── registration (MandalRegistration)
├── members (MandalMember[])
├── invites (MandalInvitation[])
└── documents (MandalDocument[])

MandalInvitation
├── id, mandalId, userId, mobile, role
├── status: PENDING | ACCEPTED | REJECTED
├── createdAt, acceptedAt
└── Auto-adds user as member when accepted

MandalMember
├── id, mandalId, userId, role
├── joinedAt
└── Can be nullable userId initially

MandalDocument
├── id, mandalId, type, fileUrl, fileId
└── Stored in ImageKit, cleaned up on delete

OTP
├── mobile, code, verified
├── expiresAt (5 minutes)
└── Auto-cleanup of expired records
```

---

## 🔐 AUTHORIZATION RULES

| Action                        | Permission      | Endpoint                    |
| ----------------------------- | --------------- | --------------------------- |
| Create Mandal                 | Any User        | POST /mandal                |
| Send Invitation               | Mandal Owner    | POST /invitation/:id/send   |
| Accept Invitation             | Invited User    | POST /invitation/:id/accept |
| Add Address/Bank/Registration | Mandal Owner    | POST /mandal/:id/\*         |
| Upload Document               | Mandal Owner    | POST /documents/upload      |
| View Documents                | Owner + Members | GET /documents/:id/list     |
| View Members                  | Anyone          | GET /members/:id/list       |
| Delete Member                 | Mandal Owner    | DELETE /members/:id         |
| Leave Mandal                  | Any Member      | POST /members/:id/leave     |

---

## 🧪 TESTING

### Run the complete activation flow:

See **TESTING_GUIDE.md** for detailed step-by-step instructions with curl commands.

### Quick Test

```bash
# 1. Send OTP
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9876543210"}'

# 2. Verify OTP (use OTP from response)
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9876543210", "otp": "123456"}'

# 3. Create Mandal (use token from response)
curl -X POST http://localhost:3000/api/mandal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name": "Test Mandal", "category": "Cultural"}'
```

---

## 📝 KEY FEATURES

✅ **OTP Authentication**

- 10-digit mobile validation
- 5-minute OTP expiry
- Automatic user creation on first login
- JWT tokens (7-day validity)

✅ **Mandal Management**

- Create, update, delete mandals
- Multiple status states (DRAFT → ACTIVE)
- Address, bank, and registration details
- Comprehensive statistics

✅ **Invitation System**

- Send invitations by mobile number
- Automatic member addition on acceptance
- Duplicate prevention
- Automatic mandal activation at 5 acceptances

✅ **Member Management**

- Auto-add on invitation acceptance
- Role management
- Member status tracking
- Leave mandal functionality

✅ **Document Management**

- ImageKit integration for file storage
- Support for JPG, PNG, PDF
- 5MB file size limit
- Auto-cleanup from ImageKit on delete

---

## 🛠️ TECH STACK

- **Framework:** Express.js (Node.js)
- **Database:** MySQL with Prisma ORM
- **Authentication:** JWT (jsonwebtoken)
- **File Upload:** ImageKit
- **Utilities:** bcryptjs, CORS, Morgan logging
- **Development:** Nodemon, Prisma CLI

---

## 📋 ENVIRONMENT VARIABLES

```env
# Server
PORT=3000

# Database
DATABASE_URL="mysql://username:password@localhost:3306/digimandal"

# JWT
JWT_SECRET="your-secret-key-minimum-32-characters"

# ImageKit (for document upload)
IMAGEKIT_PUBLIC_KEY="your_imagekit_public_key"
IMAGEKIT_PRIVATE_KEY="your_imagekit_private_key"
IMAGEKIT_URL_ENDPOINT="your_url_endpoint"
```

---

## ⚠️ COMMON ISSUES & SOLUTIONS

### Issue: Database connection failed

**Solution:**

- Check MySQL is running
- Verify DATABASE_URL in .env
- Ensure database exists: `CREATE DATABASE digimandal;`

### Issue: Prisma schema validation error

**Solution:**

```bash
npm run prisma:generate
npm run prisma:migrate
```

### Issue: OTP not working

**Solution:**

- OTP returned in response for testing
- In production, use SMS provider
- Check .env JWT_SECRET is set

### Issue: File upload fails

**Solution:**

- Verify ImageKit credentials in .env
- Check file size < 5MB
- Allowed types: JPG, PNG, PDF

---

## 🚀 DEPLOYMENT

### Production Checklist

1. **Security**

   - [ ] Remove OTP from API response
   - [ ] Use secure JWT_SECRET (minimum 32 chars)
   - [ ] Setup HTTPS
   - [ ] Enable CORS only for frontend domain
   - [ ] Validate all inputs

2. **Database**

   - [ ] Use production MySQL instance
   - [ ] Enable backups
   - [ ] Setup replication
   - [ ] Use connection pooling

3. **Performance**

   - [ ] Add database indexes
   - [ ] Setup caching (Redis)
   - [ ] Enable compression
   - [ ] Setup CDN for documents

4. **Monitoring**
   - [ ] Setup error tracking (Sentry)
   - [ ] Enable logging
   - [ ] Setup alerts
   - [ ] Monitor API response times

---

## 📞 SUPPORT

For detailed information:

1. Check **API_DOCUMENTATION.md** for complete API reference
2. See **TESTING_GUIDE.md** for testing examples
3. Review **IMPLEMENTATION_SUMMARY.md** for feature overview
4. Check **QUICK_REFERENCE.md** for quick lookup

---

## 📄 LICENSE

This project is private and confidential.

---

## ✅ CHECKLIST BEFORE DEPLOYMENT

- [ ] All 31 APIs tested
- [ ] Database migrations completed
- [ ] ImageKit credentials configured
- [ ] JWT_SECRET changed
- [ ] .env properly configured
- [ ] Error handling tested
- [ ] Authorization rules verified
- [ ] Activation flow tested (5 users)
- [ ] Documents upload/delete working
- [ ] Server graceful shutdown working

---

**Ready to use! 🚀**
