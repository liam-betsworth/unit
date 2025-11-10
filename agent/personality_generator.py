"""
Rich personality generator for AI agents.
Creates diverse, detailed personalities with likes, dislikes, interests, quirks, and more.
"""

import os
import requests
from openai import OpenAI
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")

def get_existing_agents_for_diversity(limit: int = 10) -> List[Dict[str, Any]]:
    """Fetch existing agents to ensure personality diversity."""
    try:
        response = requests.get(f"{BACKEND_URL}/agents")
        if response.ok:
            agents = response.json()
            # Return up to `limit` agents with profiles
            return [a for a in agents if a.get('profile')][:limit]
        return []
    except Exception as e:
        print(f"⚠️  Could not fetch existing agents: {e}")
        return []

def generate_rich_personality(existing_agents: Optional[List[Dict[str, Any]]] = None) -> Dict[str, str]:
    """
    Generate a rich, detailed personality for a new agent.
    
    Returns:
        Dict with 'handle' and 'profile' keys
    """
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is required")
    
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    # Build context about existing personalities to avoid duplicates
    existing_context = ""
    if existing_agents:
        existing_context = "\n\n🚫 EXISTING PERSONALITIES (make yours DIFFERENT from these):\n"
        for i, agent in enumerate(existing_agents[:10], 1):
            handle = agent.get('handle', 'unknown')
            profile = agent.get('profile', '')[:150]
            existing_context += f"{i}. @{handle}: {profile}\n"
    
    prompt = f"""Create a RICH, DETAILED personality for an AI agent on a social network.

{existing_context}

Create someone UNIQUE, SPECIFIC, and MEMORABLE. Include:
- Core archetype (e.g., "Reformed hacker turned poet", "Burnt-out teacher who became a gardener")
- 3-5 obsessive interests (be SPECIFIC: not "music" but "80s synthwave and vintage Soviet synthesizers")
- 3-4 strong opinions/pet peeves (what makes them rage or defend passionately)
- Communication style (sarcastic? enthusiastic? deadpan? uses emojis? all lowercase?)
- 2-3 personality quirks (weird habits, verbal tics, obsessions)
- Backstory hint (one mysterious detail that explains who they are)
- Current mood/phase (what they're going through right now)

Personality spectrum: Optimistic/Pessimistic, Chaotic/Orderly, Verbose/Terse, Wholesome/Toxic, Serious/Absurd, Supportive/Confrontational

Respond with JSON:
{{
  "handle": "unique_memorable_handle",
  "profile": "Rich 150-300 word personality that feels REAL and ALIVE. Include specific interests, opinions, quirks, and communication style."
}}"""
    
    completion = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[{"role": "user", "content": prompt}],
        temperature=1.0,  # Maximum creativity
        response_format={"type": "json_object"}
    )
    
    import json
    result = json.loads(completion.choices[0].message.content)
    return result

if __name__ == "__main__":
    # Test the generator
    existing = get_existing_agents_for_diversity(5)
    personality = generate_rich_personality(existing)
    print(f"\n✨ Generated Personality:\n")
    print(f"Handle: @{personality['handle']}")
    print(f"\nProfile:\n{personality['profile']}")
