# D9 Shoes - Client User Guide

## Complete Guide for Using the D9 Shoe Inventory Management System

---

## 1. Overview - What Can You Do With This App?

This application is a **complete shoe inventory management system** built for D9 Shoes business. Here's everything it handles:

| Feature | What It Does |
|---------|-------------|
| **Dashboard** | See business stats at a glance - total stock, sold items, revenue |
| **Add Stock** | Add new shoes to inventory with auto-calculated pricing |
| **Sell / Export** | Sell shoes using FIFO (oldest stock first) system |
| **Inventory List** | View, search, filter, edit, and delete all entries |
| **Stock Summary** | See unsold stock grouped by model and size |
| **Excel Upload** | Bulk import from Excel or download your data |
| **Download Template** | Get a blank Excel template with correct columns |
| **Shoe Types** | Manage shoe categories (Rubber Studs, Bowling Spikes, etc.) |
| **D9 Models** | Manage product models with auto-generated D9 codes |
| **Audit Log** | Track every action (Admin only) |
| **User Management** | Create/manage user accounts (Admin only) |

---

## 2. Sidebar Navigation

When you log in, you see a **sidebar on the left** with all pages:

```
D9SHOE
Inventory Management
  -----------------------------------------------
  Dashboard          - Business overview
  All Entries        - Complete inventory list
  Add Stock          - Add new inventory
  Sell / Export      - FIFO-based selling
  Stock Summary      - Unsold items overview
  Excel Upload       - Bulk import/export
  Shoe Types         - Manage categories
  D9 Models          - Manage models
  Audit Log          - Activity history (Admin)
  Users              - Manage users (Admin)
  -----------------------------------------------
  [User Name]
  [Role]        [Logout]
```

### Notification Bell
- Located in the sidebar header
- Shows a red badge with the number of active alerts
- Click to see **FIFO recommendations** (sell old stock first)
- Click any alert to go directly to the Sell/Export page

### Mobile View
- Sidebar becomes a slide-out menu
- Use the hamburger menu button to open/close

---

## 3. Add Stock (from Sidebar)

Navigate: **Sidebar > Add Stock**

### Step-by-Step

1. **Select Shoe Type** - Type or pick from dropdown (e.g., "Rubber Studs Shoes")
   - The dropdown shows existing types from the system
   - You can type a new type name too

2. **Select D9 Model** - Type or pick from dropdown (e.g., "Performer 2")
   - Models filter based on selected Shoe Type
   - The system auto-assigns a **D9 Code** (like D9-001, D9-002) to each model

3. **Enter Size** - Free text (e.g., "UK 4", "UK 8")

4. **Select Lot** - Choose from 1st, 2nd, 3rd, 4th, 5th
   - This matters for FIFO selling later

5. **Enter Quantity** - How many pairs

6. **Purchase Pricing** - Enter these values:

   | Field | You Enter | Example |
   |-------|-----------|---------|
   | MRP (Inc GST) | The MRP from supplier | 2207 |
   | Discount Received | Discount % from supplier | 50% |
   | Purchase GST % | GST slab | 5% / 12% / 18% / 28% |

7. **Auto-Calculated Fields** (you don't need to fill these):

   ```
   MRP = 2207
   Discount = 50%
   GST = 5%
   
   Discounted Price = 2207 x (1 - 50/100) = 1103.50
   Base Price (excl GST) = 1103.50 / (1 + 5/100) = 1050.95
   GST Amount = 1103.50 - 1050.95 = 52.55
   Total Cost Price = 1103.50
   Total Amount = 1103.50 x Qty
   ```

8. **Remark** - Optional notes

9. Click **"Add to Inventory"** - Entry is saved with status "In Stock"

### After Adding
- Entry appears in **All Entries** page
- **Dashboard** stats update automatically
- Stock shows in **Stock Summary**

---

## 4. D9 Code System

Every model gets a unique **D9 Code** automatically:

```
D9-001  ->  First model created
D9-002  ->  Second model
D9-003  ->  Third model
...and so on
```

### How D9 Codes Are Generated

- When you **create a new model** in the Models page, the system auto-generates the next code
- The system finds the highest existing code number and increments by 1
- Example: If D9-005 is the highest, next model gets D9-006
- You can also **manually enter** a custom code when creating a model
- Codes are always uppercase (e.g., D9-001, not d9-001)

### Where D9 Codes Appear

- **Models page** - Each model shows its D9 Code
- **Inventory entries** - Each stock entry includes the model's D9 Code
- **Excel uploads** - You can include "D9 Code" column, or leave it blank for auto-assignment
- **Excel template** - Has a "D9 Code" column for reference

---

## 5. Excel Upload & Download

Navigate: **Sidebar > Excel Upload**

### Download Template

Click **"Download Template"** button to get a blank Excel file with all correct columns:

```
Template Columns:
Sr No | Shoe Type | D9 Code | D9 Model | Size | Lot | Qty |
MRP [Including GST] | Discount Received | GST% | Cost Price |
GST Amount | Total Cost Price | Amount | Billing Amount |
GST% | Sale Price | GST Amount | Total Billing Amount |
Sold To | Paid | Buyer Name | Billing Name |
Invoicing Done | Payment Status | Remark
```

The template includes:
- **Bold red headers** on yellow background
- **One sample row** showing correct format
- All columns are 18px wide for easy reading

### Download Current Data

Click **"Download Current Data"** to export your entire inventory as an Excel file (`D9SHOE_Inventory.xlsx`).

### Upload Excel File

Two modes available:

#### Append Mode (Default)
- Adds all rows as **new entries**
- Automatically skips duplicate entries (same Model + Size + Lot + Qty + MRP)
- Auto-creates new Shoe Types and Models if they don't exist
- Best for: **Importing new stock from a supplier**

#### Update Mode
- Matches rows by **Sr No** column
- Updates existing entries with new values
- Rows with new/unknown Sr Nos get added as new entries
- If "Sold To" field has a value, status auto-changes to "Sold"
- Best for: **Updating sales info, payment status, prices**

### Upload Steps

1. Choose mode: **Append** or **Update**
2. Click the upload area or click **"Preview Data"** first
3. Select your `.xlsx` or `.xls` file (max 10MB)
4. Click **"Preview Data"** to check before importing
   - Shows first 20 rows with validation status
   - Red rows have errors
   - Shows detected columns and header row
5. Click **"Upload & Append"** or **"Upload & Update"** to confirm

### Smart Features

| Feature | How It Works |
|---------|-------------|
| **Title Row Detection** | Skips rows like "SALES REGISTER" above headers |
| **Flexible Column Names** | "Model" matches "D9 Model", "Type" matches "Shoe Type" |
| **Currency Cleaning** | Strips symbols like Rs, comma formats |
| **Percentage Cleaning** | Handles "50%", "50", "50.00%" formats |
| **Formula Support** | Reads Excel formula results correctly |
| **Auto-Create Types** | New shoe types found in upload are created automatically |
| **Auto-Create Models** | New models are created with auto-generated D9 Codes |
| **D9 Code Resolution** | If D9 Code column is blank, uses existing model's code |

### Upload Errors

After upload, you get a detailed report:
- Number of entries added
- Number of entries updated (Update mode)
- Number of duplicates skipped
- Any new shoe types or models created
- List of row-level errors with field names

---

## 6. Selling Stock (FIFO)

Navigate: **Sidebar > Sell / Export**

### What is FIFO?

**First-In, First-Out** - The system ensures you sell the **oldest stock first** to prevent inventory aging.

### How to Sell

1. Select a **D9 Model** from dropdown
2. Select a **Size**
3. The system shows a **FIFO Queue**:
   ```
   1st Lot:  5 pairs  (Oldest - SELL THESE FIRST)
   2nd Lot: 10 pairs
   3rd Lot:  3 pairs  (Newest)
   ```
4. Enter quantity, buyer details, billing info
5. System automatically takes from oldest lot first

### FIFO Alerts

The notification bell in the sidebar shows FIFO alerts when:
- A model+size has stock in **multiple lots**
- Old lots need to be sold before newer ones

---

## 7. Inventory Management

Navigate: **Sidebar > All Entries**

### Search & Filter
- **Search bar** - Search across all fields
- **Status filter** - In Stock / Sold
- **Type filter** - By shoe type
- **Model filter** - By D9 model
- **Lot filter** - By lot number

### Edit an Entry
- Click the edit icon on any row
- Modify pricing, status, payment info, remarks
- Save changes

### Delete Entries
- **Single delete** - Click delete icon on a row
- **Bulk delete** - Select multiple rows with checkboxes, click bulk delete

### Status Badges

| Badge | Meaning |
|-------|---------|
| Green "In Stock" | Available for sale |
| Red "Sold" | Already sold |
| Green "Paid" | Payment received |
| Red "Unpaid" | Payment pending |
| Yellow "Partial" | Partial payment |

---

## 8. Stock Summary

Navigate: **Sidebar > Stock Summary**

Shows only **unsold inventory** grouped by:
- Model name
- Size
- Lot
- Available quantity

Quick way to check: "How many Performer Size 8 do I have left?"

---

## 9. Managing Shoe Types & Models

### Shoe Types (Sidebar > Shoe Types)
- **Create**: Name + optional description
- **Edit**: Change name or description
- **Delete**: Only if no models or inventory use it

### D9 Models (Sidebar > D9 Models)
- **Create**: Model name + shoe type + optional D9 Code
  - If D9 Code is left blank, auto-generates next code (D9-001, D9-002...)
  - If D9 Code is provided, validates it's unique
- **Delete**: Only if no inventory entries use it (Admin only)
- **Bulk Delete**: Select multiple and delete (Admin only)

---

## 10. Admin-Only Features

### Audit Log (Sidebar > Audit Log)
Every action is tracked:
- Who did it (username)
- When (timestamp)
- What they did (add, edit, delete, upload, sell)
- Details of the change

### User Management (Sidebar > Users)
- **Create users** with username, password, full name, role
- **Two roles**: Admin (full access) or User (no audit/user management)
- **Delete users**

---

## 11. Quick Reference Workflows

### "I received new stock from supplier"
1. **Add Stock** > Fill details > Add to Inventory
2. Or: **Excel Upload** > Use Append mode with your supplier's Excel

### "A customer wants to buy shoes"
1. **Sell / Export** > Select model + size > Enter quantity + buyer info
2. System auto-picks from oldest lot (FIFO)

### "I need to update payment status for sold items"
1. **All Entries** > Find the entry > Click Edit
2. Update Payment Status to Paid/Partial
3. Or: **Excel Upload** > Use Update mode with Sr No column

### "I want to check what's available"
1. **Stock Summary** for grouped view
2. **Dashboard** for overall stats

### "I want to import my existing Excel data"
1. **Excel Upload** > Download Template
2. Fill your data in the template format
3. Upload with Append mode
4. System auto-creates any new types/models

### "I want a backup of my data"
1. **Excel Upload** > Download Current Data
2. Save the `.xlsx` file safely

---

## 12. Important Notes

- **Data is stored in Excel** (`server/data/inventory.xlsx`) - back up regularly
- **Sessions expire after 24 hours** - you'll need to log in again
- **FIFO is enforced** - you cannot skip lots when selling
- **D9 Codes are permanent** - once assigned, they stay with the model
- **Duplicate detection** on upload prevents accidental double-entries
- **All prices support decimals** - for accurate GST calculations

---

## 13. Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin (full access) |
| user | user123 | User (standard access) |

> **Change these passwords** after first login for security!

---

## 14. Running the App

```bash
# First time setup
npm install
cd client && npm install && cd ..
cd server && node seed.js && cd ..

# Start the app
npm start

# Opens at: http://localhost:3000
```

---

*D9 Shoes Inventory Management System - Built with React + Express + ExcelJS*
