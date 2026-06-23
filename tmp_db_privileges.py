import asyncio

from sqlalchemy import text

import database


async def main():
 async def main():
    database.init_database()
    assert database.engine is not None, "Database engine failed to initialize"
    async with database.engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                select
                    current_user,
                    current_database(),
                    current_schema(),
                    has_schema_privilege(current_user, 'public', 'USAGE') as public_usage,
                    has_schema_privilege(current_user, 'public', 'CREATE') as public_create,
                    has_database_privilege(current_user, current_database(), 'CREATE') as database_create
                """
            )
        )
        row = result.one()
        print(
            {
                "current_user": row[0],
                "current_database": row[1],
                "current_schema": row[2],
                "public_usage": row[3],
                "public_create": row[4],
                "database_create": row[5],
            }
        )


asyncio.run(main())
