#!/usr/bin/env python3
"""
Broker to User Migration Tool
Migrates records from paf_broker_info table (ncoams DB) to users table (paf_management_db DB)
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import mysql.connector
from mysql.connector import Error
import os

# Try to load environment variables from .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not installed, will use environment variables directly
    pass

class BrokerMigrationApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Broker to User Migration Tool")
        self.root.geometry("1200x800")

        # Database connections
        self.ncoams_conn = None
        self.paf_conn = None

        # Database configuration
        self.db_host = os.getenv('DB_HOST', '10.72.14.19')
        self.db_user = os.getenv('DB_USER', 'root')
        self.db_password = os.getenv('DB_PASSWORD', '')

        # Setup UI
        self.setup_ui()

        # Prompt for credentials if needed
        if not self.db_password:
            self.prompt_credentials()
        else:
            # Connect to databases
            self.connect_databases()

            # Load brokers
            self.load_brokers()

    def setup_ui(self):
        """Setup the user interface"""
        # Main container
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(2, weight=1)

        # Title
        title_label = ttk.Label(main_frame, text="Broker to User Migration Tool",
                               font=('Arial', 16, 'bold'))
        title_label.grid(row=0, column=0, columnspan=2, pady=10)

        # Broker selection frame
        selection_frame = ttk.LabelFrame(main_frame, text="Select Broker Record", padding="10")
        selection_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=10)
        selection_frame.columnconfigure(0, weight=1)

        # Broker listbox with scrollbar
        list_frame = ttk.Frame(selection_frame)
        list_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)

        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL)
        self.broker_listbox = tk.Listbox(list_frame, height=10,
                                         yscrollcommand=scrollbar.set,
                                         font=('Courier', 9))
        scrollbar.config(command=self.broker_listbox.yview)

        self.broker_listbox.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))

        self.broker_listbox.bind('<<ListboxSelect>>', self.on_broker_select)

        # Buttons frame
        button_frame = ttk.Frame(selection_frame)
        button_frame.grid(row=1, column=0, pady=10)

        ttk.Button(button_frame, text="Refresh List",
                  command=self.load_brokers).grid(row=0, column=0, padx=5)
        ttk.Button(button_frame, text="Generate INSERT Statement",
                  command=self.generate_insert).grid(row=0, column=1, padx=5)
        ttk.Button(button_frame, text="Copy to Clipboard",
                  command=self.copy_to_clipboard).grid(row=0, column=2, padx=5)

        # Generated SQL frame
        sql_frame = ttk.LabelFrame(main_frame, text="Generated INSERT Statement", padding="10")
        sql_frame.grid(row=2, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=10)
        sql_frame.columnconfigure(0, weight=1)
        sql_frame.rowconfigure(0, weight=1)

        self.sql_text = scrolledtext.ScrolledText(sql_frame, height=15, width=80,
                                                   font=('Courier', 9), wrap=tk.WORD)
        self.sql_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Broker details frame
        details_frame = ttk.LabelFrame(main_frame, text="Selected Broker Details", padding="10")
        details_frame.grid(row=3, column=0, sticky=(tk.W, tk.E), pady=10)

        self.details_text = scrolledtext.ScrolledText(details_frame, height=8, width=80,
                                                      font=('Courier', 9), wrap=tk.WORD)
        self.details_text.grid(row=0, column=0, sticky=(tk.W, tk.E))

        # Status bar
        self.status_var = tk.StringVar()
        self.status_var.set("Ready")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var,
                              relief=tk.SUNKEN, anchor=tk.W)
        status_bar.grid(row=4, column=0, sticky=(tk.W, tk.E), pady=5)

    def prompt_credentials(self):
        """Prompt for database credentials"""
        dialog = tk.Toplevel(self.root)
        dialog.title("Database Credentials")
        dialog.geometry("400x200")
        dialog.transient(self.root)
        dialog.grab_set()

        ttk.Label(dialog, text="Enter Database Credentials", font=('Arial', 12, 'bold')).pack(pady=10)

        frame = ttk.Frame(dialog, padding="20")
        frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(frame, text="Host:").grid(row=0, column=0, sticky=tk.W, pady=5)
        host_entry = ttk.Entry(frame, width=30)
        host_entry.insert(0, self.db_host)
        host_entry.grid(row=0, column=1, pady=5)

        ttk.Label(frame, text="User:").grid(row=1, column=0, sticky=tk.W, pady=5)
        user_entry = ttk.Entry(frame, width=30)
        user_entry.insert(0, self.db_user)
        user_entry.grid(row=1, column=1, pady=5)

        ttk.Label(frame, text="Password:").grid(row=2, column=0, sticky=tk.W, pady=5)
        password_entry = ttk.Entry(frame, width=30, show="*")
        password_entry.grid(row=2, column=1, pady=5)

        def on_connect():
            self.db_host = host_entry.get()
            self.db_user = user_entry.get()
            self.db_password = password_entry.get()
            dialog.destroy()
            self.connect_databases()
            self.load_brokers()

        ttk.Button(frame, text="Connect", command=on_connect).grid(row=3, column=0, columnspan=2, pady=20)

    def connect_databases(self):
        """Connect to both databases"""
        try:
            # Connect to ncoams database
            self.ncoams_conn = mysql.connector.connect(
                host=self.db_host,
                user=self.db_user,
                password=self.db_password,
                database='ncoams'
            )

            # Connect to paf_management_db database
            self.paf_conn = mysql.connector.connect(
                host=self.db_host,
                user=self.db_user,
                password=self.db_password,
                database='paf_management_db'
            )

            self.status_var.set("Connected to databases successfully")
        except Error as e:
            messagebox.showerror("Database Connection Error",
                               f"Failed to connect to databases:\n{str(e)}")
            self.status_var.set(f"Connection error: {str(e)}")

    def load_brokers(self):
        """Load broker records from paf_broker_info table"""
        if not self.ncoams_conn or not self.ncoams_conn.is_connected():
            messagebox.showerror("Error", "Not connected to ncoams database")
            return

        try:
            cursor = self.ncoams_conn.cursor(dictionary=True)
            query = """
                SELECT broker_id, company_name, licensee_id, city, state, zip, zip4, telephone
                FROM paf_broker_info
                ORDER BY company_name
            """
            cursor.execute(query)
            brokers = cursor.fetchall()
            cursor.close()

            # Clear listbox
            self.broker_listbox.delete(0, tk.END)

            # Populate listbox
            self.broker_data = []
            for broker in brokers:
                broker_id = broker.get('broker_id', '').strip() if broker.get('broker_id') else 'N/A'
                company = broker.get('company_name', '').strip() if broker.get('company_name') else 'N/A'
                licensee_id = broker.get('licensee_id', '').strip() if broker.get('licensee_id') else 'N/A'
                city = broker.get('city', '').strip() if broker.get('city') else ''
                state = broker.get('state', '').strip() if broker.get('state') else ''
                zip_code = broker.get('zip', '').strip() if broker.get('zip') else ''
                zip4 = broker.get('zip4', '').strip() if broker.get('zip4') else ''
                merged_zip = f"{zip_code}-{zip4}" if zip_code and zip4 else (zip_code or zip4)
                telephone = broker.get('telephone', '').strip() if broker.get('telephone') else ''

                display_text = f"{broker_id:8} | {company:40} | {licensee_id:6} | {city:20} | {state:2} | {merged_zip:10} | {telephone:14}"
                self.broker_listbox.insert(tk.END, display_text)
                self.broker_data.append(broker)

            self.status_var.set(f"Loaded {len(brokers)} broker records")
        except Error as e:
            messagebox.showerror("Error", f"Failed to load brokers:\n{str(e)}")
            self.status_var.set(f"Error loading brokers: {str(e)}")

    def on_broker_select(self, event):
        """Handle broker selection"""
        selection = self.broker_listbox.curselection()
        if not selection:
            return

        index = selection[0]
        broker = self.broker_data[index]

        # Determine agent type
        bla_value = broker.get('broker_list_admin', '')
        if bla_value:
            bla_value = bla_value.strip()
        agent_type_display = 'N/A'
        if bla_value == 'B':
            agent_type_display = 'broker (from B)'
        elif bla_value == 'L':
            agent_type_display = 'listadmin (from L)'
        elif bla_value:
            agent_type_display = f'{bla_value} (unmapped)'

        # Display broker details
        self.details_text.delete('1.0', tk.END)
        details = f"""Selected Broker Details:
{'='*80}
Broker ID:       {broker.get('broker_id', 'N/A')}
Company Name:    {broker.get('company_name', 'N/A')}
Licensee ID:     {broker.get('licensee_id', 'N/A')}
SIC:             {broker.get('broker_sic', 'N/A')}
Address:         {broker.get('address', 'N/A')}
City:            {broker.get('city', 'N/A')}
State:           {broker.get('state', 'N/A')}
ZIP:             {broker.get('zip', 'N/A')}
ZIP4:            {broker.get('zip4', 'N/A')}
Telephone:       {broker.get('telephone', 'N/A')}
Fax:             {broker.get('fax', 'N/A')}
Email:           {broker.get('email', 'N/A')}
Website:         {broker.get('website', 'N/A')}
Federal TIN:     {broker.get('federal_tin', 'N/A')}
Broker List Admin: {broker.get('broker_list_admin', 'N/A')} → Will become: {agent_type_display}
Notes:           {broker.get('notes', 'N/A')}

MIGRATION MAPPINGS:
→ Role will be: USER
→ Agent Type will be: {agent_type_display}
→ ZIP will be merged: {broker.get('zip', '')}-{broker.get('zip4', '') if broker.get('zip4') else ''}
"""
        self.details_text.insert('1.0', details)

    def generate_insert(self):
        """Generate INSERT statement for selected broker"""
        selection = self.broker_listbox.curselection()
        if not selection:
            messagebox.showwarning("Warning", "Please select a broker record first")
            return

        index = selection[0]
        broker = self.get_full_broker_details(self.broker_data[index]['broker_id'])

        if not broker:
            messagebox.showerror("Error", "Failed to retrieve broker details")
            return

        # Map fields from paf_broker_info to users table
        # Handle None values and strip whitespace
        def clean(value):
            return value.strip() if value and isinstance(value, str) else value

        def quote(value):
            if value is None or value == '':
                return 'NULL'
            # Escape single quotes
            escaped = str(value).replace("'", "''")
            return f"'{escaped}'"

        # Merge ZIP and ZIP4
        zip_code = clean(broker.get('zip', ''))
        zip4 = clean(broker.get('zip4', ''))
        merged_zip = zip_code
        if zip4 and zip4 != '':
            merged_zip = f"{zip_code}-{zip4}" if zip_code else zip4

        # Determine agent type from broker_list_admin field
        broker_list_admin_value = clean(broker.get('broker_list_admin', ''))
        agent_type = None
        if broker_list_admin_value == 'B':
            agent_type = 'broker'
        elif broker_list_admin_value == 'L':
            agent_type = 'listadmin'

        # Generate INSERT statement
        insert_sql = f"""-- Migration from paf_broker_info (broker_id: {broker.get('broker_id', 'N/A')})
-- Generated: {self.get_timestamp()}

INSERT INTO paf_management_db.users (
    first_name,
    last_name,
    email,
    password,
    role,
    usps_license_id,
    licensee_name,
    broker_list_admin,
    street_address,
    city,
    state,
    zip,
    phone_number,
    SIC,
    use_email,
    fax,
    website,
    created_at,
    updated_at
) VALUES (
    'BROKER',  -- first_name (placeholder - UPDATE REQUIRED)
    {quote(clean(broker.get('company_name', 'BROKER')))},  -- last_name (using company name)
    {quote(clean(broker.get('email', '')))},  -- email (UPDATE REQUIRED if NULL)
    '$2a$10$placeholder',  -- password (placeholder - MUST BE UPDATED)
    'USER',  -- role (always USER for brokers)
    {quote(clean(broker.get('licensee_id', '')))},  -- usps_license_id (from licensee_id)
    {quote(clean(broker.get('company_name', '')))},  -- licensee_name (from company_name)
    {quote(agent_type) if agent_type else 'NULL'},  -- broker_list_admin (broker/listadmin based on B/L)
    {quote(clean(broker.get('address', '')))},  -- street_address
    {quote(clean(broker.get('city', '')))},  -- city
    {quote(clean(broker.get('state', '')))},  -- state
    {quote(merged_zip)},  -- zip (merged ZIP + ZIP4)
    {quote(clean(broker.get('telephone', '')))},  -- phone_number
    {quote(clean(broker.get('broker_sic', '')))},  -- SIC (from broker_sic)
    {quote(clean(broker.get('email', '')))},  -- use_email
    {quote(clean(broker.get('fax', '')))},  -- fax
    {quote(clean(broker.get('website', '')))},  -- website
    NOW(),  -- created_at
    NOW()   -- updated_at
);

-- IMPORTANT NOTES:
-- 1. UPDATE the first_name field with actual first name
-- 2. UPDATE the last_name field with actual last name
-- 3. UPDATE the email field if NULL or invalid
-- 4. UPDATE the password field with a properly hashed password
-- 5. Role is set to 'USER' (not 'AGENT')
-- 6. Agent type (broker_list_admin): {'broker' if agent_type == 'broker' else ('listadmin' if agent_type == 'listadmin' else 'NULL')} (from '{broker_list_admin_value}')
-- 7. Original broker_id: {broker.get('broker_id', 'N/A')}
-- 8. Federal TIN: {broker.get('federal_tin', 'N/A')}
-- 9. Notes: {broker.get('notes', 'N/A')}
"""

        # Display SQL
        self.sql_text.delete('1.0', tk.END)
        self.sql_text.insert('1.0', insert_sql)

        self.status_var.set(f"INSERT statement generated for broker {broker.get('broker_id', 'N/A')}")

    def get_full_broker_details(self, broker_id):
        """Get full broker details from database"""
        if not self.ncoams_conn or not self.ncoams_conn.is_connected():
            return None

        try:
            cursor = self.ncoams_conn.cursor(dictionary=True)
            query = "SELECT * FROM paf_broker_info WHERE broker_id = %s"
            cursor.execute(query, (broker_id,))
            broker = cursor.fetchone()
            cursor.close()
            return broker
        except Error as e:
            messagebox.showerror("Error", f"Failed to get broker details:\n{str(e)}")
            return None

    def copy_to_clipboard(self):
        """Copy SQL to clipboard"""
        sql = self.sql_text.get('1.0', tk.END).strip()
        if not sql:
            messagebox.showwarning("Warning", "No SQL statement to copy")
            return

        self.root.clipboard_clear()
        self.root.clipboard_append(sql)
        self.root.update()
        messagebox.showinfo("Success", "SQL statement copied to clipboard")
        self.status_var.set("SQL copied to clipboard")

    def get_timestamp(self):
        """Get current timestamp"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def __del__(self):
        """Cleanup database connections"""
        if self.ncoams_conn and self.ncoams_conn.is_connected():
            self.ncoams_conn.close()
        if self.paf_conn and self.paf_conn.is_connected():
            self.paf_conn.close()

def main():
    root = tk.Tk()
    app = BrokerMigrationApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
