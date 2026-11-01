from intake import get_user_context
from graph_orchestrator import run
from state import create_state

if __name__ == "__main__":
    idea = input("Enter startup idea: ").strip()
    context = get_user_context(idea)
    run(idea, context)