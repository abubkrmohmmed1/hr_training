"""Initial enterprise schema migration.

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-09 05:45:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables are auto-managed by Base.metadata.create_all() or Alembic versioning
    pass


def downgrade() -> None:
    pass
