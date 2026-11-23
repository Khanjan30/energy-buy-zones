"""Signals and the competing formulas built from them."""

FAMILIES = {
    "value": "Fundamentals: value",
    "strength": "Fundamentals: strength",
    "growth": "Fundamentals: growth",
    "technical": "Technicals",
    "politics": "Politics, laws and geopolitics",
    "macro": "Rates, oil and gas",
    "current": "Current formula",
}

# key, family, plain-language name, what a high value means
FACTORS = [
    ("v_pe_own", "value", "Cheap against its own history", "Price to earnings low compared with the stock's own five-year normal"),
    ("v_ev_ebitda", "value", "Cheap against cash earnings", "Company value low compared with yearly cash earnings"),
    ("v_fcf_yield", "value", "Spare cash for the price", "Free cash flow high compared with the share price"),
    ("v_earn_yield", "value", "Earnings for the price", "Profit per share high compared with the price"),
    ("q_leverage", "strength", "Low debt", "Debt small compared with yearly cash earnings"),
    ("q_coverage", "strength", "Interest easily covered", "Cash earnings many times the interest bill"),
    ("q_fcf_years", "strength", "Steady spare cash", "Positive free cash flow in most of the last five years"),
    ("q_margin", "strength", "High profit margin", "Operating profit high as a share of sales"),
    ("g_rev", "growth", "Sales growth", "Sales grew fast over three years"),
    ("g_eps", "growth", "Earnings growth", "Earnings per share grew fast over three years"),
    ("t_mom_12_1", "technical", "Momentum", "Price rose most over the past year, skipping the last month"),
    ("t_mom_6", "technical", "Six-month momentum", "Price rose most over six months"),
    ("t_trend", "technical", "Above its long-term average", "Price high compared with its 200-day average"),
    ("t_near_high", "technical", "Near its 52-week high", "Price close to its high of the past year"),
    ("t_low_vol", "technical", "Calm price", "Daily price swings small over the past year"),
    ("t_oversold", "technical", "Oversold", "Momentum oscillator low, meaning the price fell fast recently"),
    ("m_gpr", "politics", "Geopolitics tailwind", "Rises when geopolitical risk rises, and geopolitical risk is rising now"),
    ("m_epu", "politics", "Policy uncertainty tailwind", "Does well when US policy uncertainty moves the way it is moving now"),
    ("m_cpu", "politics", "Climate policy tailwind", "Does well when climate policy uncertainty moves the way it is moving now"),
    ("m_reg", "politics", "Regulation tailwind", "Does well when its regulators' rule-making moves the way it is moving now"),
    ("m_policy_proof", "politics", "Policy-proof", "Barely reacts to geopolitics, policy uncertainty or new rules"),
    ("m_disaster", "politics", "Few recent disasters", "Few federal disaster declarations in the states it serves over six months"),
    ("m_rates", "macro", "Interest rate tailwind", "Does well when rates move the way they are moving now"),
    ("m_oil", "macro", "Oil price tailwind", "Does well when oil moves the way it is moving now"),
    ("m_gas", "macro", "Gas price tailwind", "Does well when natural gas moves the way it is moving now"),
    ("v1_score", "current", "Current quality score", "Version 1 score from value, strength and growth, without the hand-kept event log"),
]
FACTOR_FAMILY = {k: f for k, f, _, _ in FACTORS}


def fam(*names):
    return [k for k, f, _, _ in FACTORS if f in names]


STRATEGIES = [
    {"id": "v1", "name": "Current formula (version 1)", "plain": "Today's quality score, rebuilt the same way at each past date.", "factors": ["v1_score"]},
    {"id": "value", "name": "Value", "plain": "Buy what is cheapest compared with earnings and cash.", "factors": fam("value")},
    {"id": "strength", "name": "Financial strength", "plain": "Buy the sturdiest balance sheets and the best margins.", "factors": fam("strength")},
    {"id": "growth", "name": "Growth", "plain": "Buy the fastest growers.", "factors": fam("growth")},
    {"id": "momentum", "name": "Momentum", "plain": "Buy what has been rising and sits near its high.", "factors": ["t_mom_12_1", "t_mom_6", "t_near_high"]},
    {"id": "trend_calm", "name": "Trend and calm", "plain": "Buy steady stocks trading above their long-term average.", "factors": ["t_trend", "t_low_vol"]},
    {"id": "politics", "name": "Politics, laws and geopolitics", "plain": "Buy what current geopolitics, policy uncertainty, rule-making and disasters favor, and what is least exposed to them.", "factors": fam("politics")},
    {"id": "macro", "name": "Rates, oil and gas", "plain": "Buy what the current direction of rates, oil and gas favors.", "factors": fam("macro")},
    {"id": "quality_momentum", "name": "Strength plus momentum", "plain": "Sturdy businesses whose prices are rising.", "factors": fam("strength") + ["t_mom_12_1", "t_near_high"]},
    {"id": "value_momentum", "name": "Value plus momentum", "plain": "Cheap stocks that have started to rise.", "factors": fam("value") + ["t_mom_12_1", "t_near_high"]},
    {"id": "fundamentals", "name": "All fundamentals", "plain": "Value, strength and growth together.", "factors": fam("value", "strength", "growth")},
    {"id": "fund_tech", "name": "Fundamentals plus technicals", "plain": "Every fundamental and technical signal, each family counted equally.", "families": ["value", "strength", "growth", "technical"]},
    {"id": "all_equal", "name": "Everything, counted equally", "plain": "Every family, including politics and macro, counted equally.", "families": ["value", "strength", "growth", "technical", "politics", "macro"]},
    {"id": "learned", "name": "Everything, weights learned from the past", "plain": "Each signal weighted by how well it worked in the training years only, then tested on later years it never saw.", "learned": True},
]
