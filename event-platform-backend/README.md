# event-platform-backend

## Event Platform Backend — Run Guide

This document explains how to **set up and run the project locally**.

---

### Prerequisites

Make sure the following are installed:

- **Python 3.10+**
- **PostgreSQL**
- **uv** (Python package & environment manager)

Install `uv` if it is not installed:

```bash
pip install uv
```

#### 1. Install Dependencies

Run the following command in the **project root directory**:

```bash
uv sync
```

This will:

Create a virtual environment

Install all dependencies from pyproject.toml

#### 2. Initialize the Database (First Time Only)

Run this command only once to create database tables:

```bash
uv run python -m app.db.init_db
```

#### 3. Start the Backend Server

Run:
```bash
uv run uvicorn main:app --reload
```

The API server will start at:

http://127.0.0.1:8000

API docs will be available at:

http://127.0.0.1:8000/docs


### For Seed Required Data

Open another terminal and run:
```bash
uv run python -m scripts.seed_listing_fields
```
This command seeds base listing configuration fields.

Now, Generate Fake Marketplace Data

Then run:
```bash
uv run python -m scripts.generate_fake_data
```
This generates:

Users

Vendors

Listings

Listing images

Bookings

Reviews

This allows the frontend to display realistic marketplace data.

##### Run Summary
Terminal 1
```bash
uv sync
uv run python -m app.db.init_db   # first time only
uv run uvicorn main:app --reload
```
Terminal 2

```bash
uv run python -m scripts.seed_listing_fields
uv run python -m scripts.generate_fake_data
```