import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

const DEFAULT_ACCOUNTS = [

  // ── ASSETS (1000–1999) ──────────────────────────────────────────────────────
  // Cash & Bank
  { code: "1001", name: "Cash in Hand",                   type: "ASSET",     description: "Physical cash in drawer or safe" },
  { code: "1002", name: "Petty Cash",                     type: "ASSET",     description: "Small day-to-day cash fund" },
  { code: "1010", name: "Bank Account - Main",            type: "ASSET",     description: "Primary current/business bank account" },
  { code: "1011", name: "Bank Account - Savings",         type: "ASSET",     description: "Savings or secondary bank account" },
  // Receivables
  { code: "1020", name: "Accounts Receivable - Traders",  type: "ASSET",     description: "Credit owed by buyers / traders" },
  { code: "1021", name: "Accounts Receivable - Farmers",  type: "ASSET",     description: "Credit owed by farmers for sales/pesticides" },
  { code: "1022", name: "Accounts Receivable - Other",    type: "ASSET",     description: "Other parties who owe money" },
  // Advances
  { code: "1030", name: "Advance to Farmers (Peshgi)",    type: "ASSET",     description: "Peshgi / advance paid to farmers against crop" },
  { code: "1031", name: "Advance to Suppliers",           type: "ASSET",     description: "Advance paid to suppliers before delivery" },
  { code: "1032", name: "Advance to Staff",               type: "ASSET",     description: "Salary or personal advances given to employees" },
  // Stock
  { code: "1040", name: "Stock - Products / Store",       type: "ASSET",     description: "Value of products held in store / inventory" },
  { code: "1041", name: "Stock - Pesticides",             type: "ASSET",     description: "Value of pesticide stock on hand" },
  // Other Assets
  { code: "1050", name: "Pesticide Incentive Receivable", type: "ASSET",     description: "Incentive promised by pesticide company not yet received" },
  { code: "1051", name: "Prepaid Rent",                   type: "ASSET",     description: "Rent paid in advance for future periods" },
  { code: "1060", name: "Furniture & Fixtures",           type: "ASSET",     description: "Office and shop furniture" },
  { code: "1061", name: "Machinery & Equipment",          type: "ASSET",     description: "Weighing scales, computers and business equipment" },
  { code: "1062", name: "Vehicle",                        type: "ASSET",     description: "Business-owned vehicles" },

  // ── LIABILITIES (2000–2999) ─────────────────────────────────────────────────
  // Payables
  { code: "2001", name: "Accounts Payable - Suppliers",   type: "LIABILITY", description: "Amount owed to product suppliers on credit" },
  { code: "2002", name: "Commission Payable to Farmers",  type: "LIABILITY", description: "Seller payable owed to farmers from commission deals" },
  { code: "2003", name: "Salaries Payable",               type: "LIABILITY", description: "Staff salaries due but not yet paid" },
  // Advances Received
  { code: "2010", name: "Advance from Traders",           type: "LIABILITY", description: "Advance received from buyers / traders" },
  { code: "2011", name: "Advance from Farmers",           type: "LIABILITY", description: "Advance received from farmers" },
  // Loans
  { code: "2020", name: "Bank Loan Payable",              type: "LIABILITY", description: "Loans taken from bank — principal outstanding" },
  { code: "2021", name: "Personal / Private Loan",        type: "LIABILITY", description: "Loans taken from individuals or private lenders" },
  // Other
  { code: "2030", name: "Tax Payable",                    type: "LIABILITY", description: "Income tax, sales tax or other taxes due to government" },
  { code: "2040", name: "Other Payables",                 type: "LIABILITY", description: "Miscellaneous amounts owed" },

  // ── EQUITY (3000–3999) ──────────────────────────────────────────────────────
  { code: "3001", name: "Owner Capital",                  type: "EQUITY",    description: "Total investment by owner in the business" },
  { code: "3002", name: "Owner Drawings",                 type: "EQUITY",    description: "Cash or goods withdrawn by owner for personal use" },
  { code: "3003", name: "Retained Earnings",              type: "EQUITY",    description: "Accumulated profits kept in the business" },

  // ── INCOME (4000–4999) ──────────────────────────────────────────────────────
  // Core mandi income
  { code: "4001", name: "Commission Income (Aadat)",      type: "INCOME",    description: "Mandi / aadat commission earned on crop sales" },
  { code: "4002", name: "Sales Income - Products",        type: "INCOME",    description: "Revenue from selling store products to traders/farmers" },
  { code: "4003", name: "Sales Income - Pesticides",      type: "INCOME",    description: "Revenue from pesticide sales" },
  { code: "4004", name: "Freight / Transport Income",     type: "INCOME",    description: "Charges collected for transport and delivery services" },
  { code: "4005", name: "Weighbridge / Gate Income",      type: "INCOME",    description: "Fees collected at gate or weighbridge" },
  { code: "4006", name: "Pesticide Incentive Income",     type: "INCOME",    description: "Incentives and bonuses received from pesticide companies" },
  { code: "4007", name: "Godown / Warehouse Rent",        type: "INCOME",    description: "Rent received for storage space in godown or warehouse" },
  { code: "4008", name: "Bank Profit / Interest",         type: "INCOME",    description: "Profit on savings accounts or bank deposits" },
  { code: "4009", name: "Other Income",                   type: "INCOME",    description: "Any other income not categorised above" },

  // ── EXPENSES (5000–5999) ────────────────────────────────────────────────────
  // Cost of Sales
  { code: "5001", name: "Purchases - Products",           type: "EXPENSE",   description: "Cost of products purchased for resale" },
  { code: "5002", name: "Purchases - Pesticides",         type: "EXPENSE",   description: "Cost of pesticides purchased for resale" },
  // Labour
  { code: "5010", name: "Labour - Daily Wages",           type: "EXPENSE",   description: "Mazadoor and daily wage workers" },
  { code: "5011", name: "Labour - Loading & Unloading",   type: "EXPENSE",   description: "Charges for loading/unloading goods at mandi" },
  // Salaries
  { code: "5020", name: "Salaries - Office Staff",        type: "EXPENSE",   description: "Monthly salaries of office and admin employees" },
  { code: "5021", name: "Salaries - Management",          type: "EXPENSE",   description: "Monthly salaries of managers and senior staff" },
  // Rent
  { code: "5030", name: "Rent - Shop / Office",           type: "EXPENSE",   description: "Rent paid for shop or office space" },
  { code: "5031", name: "Rent - Godown / Warehouse",      type: "EXPENSE",   description: "Rent paid for godown or storage facility" },
  // Utilities
  { code: "5040", name: "Electricity Bills",              type: "EXPENSE",   description: "Monthly electricity charges" },
  { code: "5041", name: "Fuel & Generator",               type: "EXPENSE",   description: "Diesel, petrol and generator running costs" },
  { code: "5042", name: "Gas Bills",                      type: "EXPENSE",   description: "Natural gas or LPG charges" },
  { code: "5043", name: "Water Charges",                  type: "EXPENSE",   description: "Water supply bills" },
  // Transport
  { code: "5050", name: "Transport / Freight Paid",       type: "EXPENSE",   description: "Freight charges paid to transporters" },
  { code: "5051", name: "Vehicle Running Costs",          type: "EXPENSE",   description: "Fuel, tolls and daily running costs of vehicles" },
  // Operations
  { code: "5060", name: "Commission Paid to Agents",      type: "EXPENSE",   description: "Commission or brokerage paid to sales agents" },
  { code: "5061", name: "Weighbridge / Gate Charges",     type: "EXPENSE",   description: "Fees paid at gate, weighbridge or market entry" },
  { code: "5062", name: "Market Committee Fee",           type: "EXPENSE",   description: "Mandi committee and market association fees" },
  { code: "5063", name: "Mandi Tax / Cess",               type: "EXPENSE",   description: "Government levied mandi tax or agricultural cess" },
  // Finance
  { code: "5070", name: "Bank Charges & Fees",            type: "EXPENSE",   description: "Bank service charges, transfer fees and maintenance" },
  { code: "5071", name: "Loan Interest / Mark-up",        type: "EXPENSE",   description: "Interest or Islamic mark-up on bank or personal loans" },
  // Repairs & Maintenance
  { code: "5080", name: "Repairs - Building",             type: "EXPENSE",   description: "Repair and maintenance of shop, office or godown" },
  { code: "5081", name: "Repairs - Equipment",            type: "EXPENSE",   description: "Repair of weighing scales, computers and machinery" },
  { code: "5082", name: "Repairs - Vehicle",              type: "EXPENSE",   description: "Vehicle servicing, repairs and maintenance" },
  // Administration
  { code: "5090", name: "Office Stationery & Supplies",   type: "EXPENSE",   description: "Paper, pens, registers and general office supplies" },
  { code: "5091", name: "Printing & Stamps",              type: "EXPENSE",   description: "Printing costs, stamps and postage" },
  { code: "5092", name: "Telephone & Internet",           type: "EXPENSE",   description: "Mobile bills, landline and internet charges" },
  { code: "5093", name: "Advertisement & Promotion",      type: "EXPENSE",   description: "Marketing, signboards, banners and promotions" },
  // Legal & Government
  { code: "5100", name: "Taxes & Government Fees",        type: "EXPENSE",   description: "FBR income tax, sales tax and other government levies" },
  { code: "5101", name: "Trade License & Registration",   type: "EXPENSE",   description: "Annual trade license, CNIC registration and renewals" },
  { code: "5102", name: "Professional & Legal Fees",      type: "EXPENSE",   description: "Accountant, lawyer and consultancy fees" },
  // Miscellaneous
  { code: "5110", name: "Miscellaneous Expenses",         type: "EXPENSE",   description: "Any other expense not categorised above" },

] as const

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const existing = await db.account.count({ where: shopFilter })

  if (existing > 0) {
    return NextResponse.json({ message: "Accounts already seeded", skipped: true })
  }

  const accounts = await db.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({
      ...a,
      shopId: session.user.shopId || null,
    })),
  })

  return NextResponse.json({ success: true, created: accounts.count })
}
