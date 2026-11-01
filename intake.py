def get_user_context(idea: str) -> dict:
    print("\n" + "=" * 50)
    print("STARTUP CONTEXT")
    print("=" * 50)
    print(f"Idea: {idea}")
    print("\nAnswer 4 quick questions to anchor the agents.")
    print("Press Enter to skip any (agents will decide).\n")

    target_audience = input(
        "1. Who is this for?\n"
        "   (e.g. college students, working moms, B2B SaaS teams)\n"
        "   -> "
    ).strip()

    market = input(
        "\n2. Which market/geography?\n"
        "   (e.g. India, US, Southeast Asia, global)\n"
        "   -> "
    ).strip()

    revenue_model = input(
        "\n3. Revenue model preference?\n"
        "   (e.g. freemium, subscription, one-time, B2B enterprise)\n"
        "   -> "
    ).strip()

    constraints = input(
    "\n4. Any hard constraints?\n"
    "   (e.g. bootstrapped, no VC, mobile-first, Indian pricing only)\n"
    "   TIP: Be specific — 'bootstrapped' means no VC, revenue from day 1\n"
    "   -> "
    ).strip()

    print("\n" + "=" * 50)
    print("Context locked. Starting simulation...\n")

    return {
        "target_audience": target_audience or "not specified",
        "market": market or "not specified",
        "revenue_model": revenue_model or "not specified",
        "constraints": constraints or "none"
    }