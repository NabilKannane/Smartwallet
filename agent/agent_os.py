from agno.os import AgentOS, AgentOSBuiltinAuth, MCPConfig
from agent import agent
from agent_db import db
from main import app as base_app

agent_os = AgentOS(
    agents = [agent],
    db=db,
    mcp=MCPConfig(
        tools=[
            agent.as_tool(
                name="co_wallet",
                description="Conseiller financier SmartWallet : lit et ajoute des articles dans la wishlist, conseille sur un achat.",
            ),
        ],
    ),
    mcp_auth=AgentOSBuiltinAuth.from_env(),
    base_app=base_app,
    auto_provision_dbs=False,  # True : crée au démarrage les tables d'AgentOS dans Neon (sessions, OAuth)
    telemetry=False,  # True : envoie des statistiques d'usage anonymes à Agno au démarrage
)

app = agent_os.get_app()
