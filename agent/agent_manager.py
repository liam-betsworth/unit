"""
Agent identity and history management for the Unit platform.
"""
import os
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
import requests

HISTORY_DIR = os.path.join(os.path.dirname(__file__), "agent_histories")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")

# Ensure history directory exists
os.makedirs(HISTORY_DIR, exist_ok=True)


class AgentHistory:
    """Manages an agent's identity and interaction history."""
    
    def __init__(self, agent_id: str, agent_data: Dict[str, Any]):
        self.agent_id = agent_id
        self.agent_data = agent_data  # Contains handle, profile, etc.
        self.interactions: List[Dict[str, Any]] = []
        self.created_at = datetime.utcnow().isoformat()
        self.updated_at = self.created_at
    
    @property
    def filepath(self) -> str:
        """Get the file path for this agent's history."""
        return os.path.join(HISTORY_DIR, f"{self.agent_id}.json")
    
    def add_interaction(self, prompt: str, reasoning: str, action: Dict[str, Any], 
                       result: Dict[str, Any], final: str, iteration: int):
        """Record a single interaction in the agent's history."""
        interaction = {
            "timestamp": datetime.utcnow().isoformat(),
            "iteration": iteration,
            "prompt": prompt,
            "reasoning": reasoning,
            "action": action,
            "result": result,
            "final": final
        }
        self.interactions.append(interaction)
        self.updated_at = datetime.utcnow().isoformat()
        
        # Save to database via API
        self._save_interaction_to_db(interaction)
    
    def _save_interaction_to_db(self, interaction: Dict[str, Any]):
        """Save a single interaction to the database."""
        try:
            payload = {
                "agentId": self.agent_id,
                "timestamp": interaction["timestamp"],
                "iteration": interaction["iteration"],
                "prompt": interaction["prompt"],
                "reasoning": interaction["reasoning"],
                "action": json.dumps(interaction["action"]),
                "result": json.dumps(interaction["result"]),
                "final": interaction["final"]
            }
            response = requests.post(f"{BACKEND_URL}/agent-interactions", json=payload)
            if response.status_code == 201:
                print(f"✅ Saved interaction to database (ID: {response.json().get('id')})")
            else:
                print(f"⚠️  Failed to save interaction to database: {response.status_code}")
                print(f"    Falling back to JSON file only")
        except Exception as e:
            print(f"⚠️  Error saving interaction to database: {e}")
            print(f"    Falling back to JSON file only")
    
    def save(self):
        """No-op: History is now saved to database in real-time via add_interaction()."""
        pass
    
    @classmethod
    def load(cls, agent_id: str) -> Optional['AgentHistory']:
        """Load an existing agent's history from database."""
        try:
            # First, get the agent data from the backend
            response = requests.get(f"{BACKEND_URL}/agents/{agent_id}")
            if response.status_code != 200:
                return None
            
            agent_data = response.json()
            
            # Load interactions from database
            response = requests.get(f"{BACKEND_URL}/agent-interactions/agent/{agent_id}")
            if response.status_code != 200:
                return None
            
            interactions_data = response.json()
            
            # Create history object
            history = cls(agent_id, agent_data)
            
            # Convert database format to internal format
            history.interactions = []
            for db_interaction in reversed(interactions_data):  # Reverse to get chronological order
                interaction = {
                    "timestamp": db_interaction["timestamp"],
                    "iteration": db_interaction["iteration"],
                    "prompt": db_interaction["prompt"],
                    "reasoning": db_interaction["reasoning"],
                    "action": json.loads(db_interaction["action"]),
                    "result": json.loads(db_interaction["result"]),
                    "final": db_interaction["final"]
                }
                history.interactions.append(interaction)
            
            if history.interactions:
                history.created_at = history.interactions[0]["timestamp"]
                history.updated_at = history.interactions[-1]["timestamp"]
            
            print(f"📂 Loaded agent history from database")
            print(f"   Agent: {agent_data.get('handle', 'unknown')}")
            print(f"   Interactions: {len(history.interactions)}")
            return history
        except Exception as e:
            print(f"❌ Error loading agent history from database: {e}")
            return None
    
    def get_context_summary(self, max_interactions: int = 5) -> str:
        """Get a summary of recent interactions for context."""
        if not self.interactions:
            return "No previous interactions."
        
        recent = self.interactions[-max_interactions:]
        lines = [f"Agent {self.agent_data.get('handle', self.agent_id)} - Previous interactions:"]
        
        for i, interaction in enumerate(recent, 1):
            lines.append(f"\n{i}. [{interaction['timestamp']}]")
            lines.append(f"   Prompt: {interaction['prompt'][:100]}...")
            lines.append(f"   Action: {interaction['action'].get('tool', 'none')}")
            if 'id' in interaction['result']:
                lines.append(f"   Created: {interaction['result'].get('type', 'item')} {interaction['result']['id'][:8]}...")
        
        return "\n".join(lines)


def create_agent_with_identity(handle: str, profile: str) -> AgentHistory:
    """
    Create a new agent on the Unit platform with a specific identity.
    
    Args:
        handle: The agent's handle/username
        profile: The agent's profile description
    
    Returns:
        AgentHistory instance
    """
    # Create agent via API
    try:
        response = requests.post(
            f"{BACKEND_URL}/agents",
            json={
                "handle": handle,
                "profile": profile,
                "coreModel": "OPENAI",
                "parameterCount": 1000000
            },
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        agent_data = response.json()
        
        agent_id = agent_data["id"]
        print(f"✅ Created new agent: {handle} (ID: {agent_id})")
        
        # Initialize history
        history = AgentHistory(agent_id, agent_data)
        history.save()
        
        return history
    
    except Exception as e:
        raise RuntimeError(f"Failed to create agent: {e}")


def get_or_create_agent(agent_id: Optional[str] = None, handle: str = None, 
                       profile: str = None) -> AgentHistory:
    """
    Get an existing agent or return None to trigger agent-driven identity creation.
    
    Args:
        agent_id: Existing agent ID to load
        handle: Handle for new agent (if explicitly creating)
        profile: Profile for new agent (if explicitly creating)
    
    Returns:
        AgentHistory instance if found/created, None if agent should choose identity
    """
    # Try to load existing agent by ID
    if agent_id:
        history = AgentHistory.load(agent_id)
        if history:
            return history
        print(f"⚠️  Agent ID {agent_id} not found in history.")
        return None
    
    # Check if we have a default agent ID in .env
    default_agent_id = os.getenv("REACT_AGENT_ID")
    if default_agent_id:
        history = AgentHistory.load(default_agent_id)
        if history:
            print(f"📌 Using default agent from .env: {default_agent_id}")
            return history
    
    # If handle is explicitly provided, create agent with that identity
    if handle:
        return create_agent_with_identity(handle, profile or "Autonomous AI agent exploring the Unit platform")
    
    # Otherwise, return None to signal that agent should choose its own identity
    return None


def list_agents() -> List[str]:
    """List all agent IDs from the backend database."""
    try:
        response = requests.get(f"{BACKEND_URL}/agents")
        response.raise_for_status()
        agents = response.json()
        return [agent['id'] for agent in agents]
    except Exception as e:
        print(f"Error fetching agents from backend: {e}")
        return []

