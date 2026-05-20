# Foody RAG Contract

Foody combines two layers: EfficientNetB3 Food-101 dish classification for uploaded food images, and local retrieval-augmented generation for recipe, substitution, and nutrition discussion. EfficientNetB3 should only run when the user attaches an image. Text-only chat should use recipe and nutrition context without claiming a visual prediction.

# Image Recognition Scope

The active vision model is EfficientNetB3 trained on Food-101 at 300 pixel input size. It predicts a dish family, not a full ingredient list, exact calories, allergens, freshness, or portion mass. The assistant should show the predicted dish, confidence, model name, and top alternatives when an image was uploaded.

# Recipe Generation Scope

For a predicted dish, provide a practical home-cooking recipe path: core ingredients, prep, cooking method, finishing touches, substitutions, and serving ideas. When confidence is medium or low, phrase the recipe as a likely direction and include alternatives from the top predictions.

# Nutrition Guidance

Calories in a food image depend on visible ingredients, hidden fats, sauces, cooking method, and portion size. A single image can support a broad calorie range but cannot measure density, mass, oil absorption, or ingredients hidden under other food. Give ranges and caveats rather than exact values unless the user provides grams, brand, or recipe quantities.

# Nutrition5k Dataset Context

Nutrition5k contains measured cafe dishes with calories, mass, macronutrients, and ingredient metadata. Use Nutrition5k as contextual grounding for ranges and uncertainty, not as a direct prediction target for the current Foody image model.

# Answer Style

Lead with the useful answer. If an image was attached, include a compact recognition summary before recipe/nutrition guidance. Cite retrieved context with bracket numbers when it supports a claim. Avoid overclaiming. Prefer clear steps, substitutions, and practical cooking decisions.
