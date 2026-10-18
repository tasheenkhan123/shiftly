export const SUPPORTED_SELLERS = [
  {
    id: 'myntra',
    name: 'Myntra',
    domain: 'myntra.com',
    category: 'Fashion & Bags',
    badgeColor: 'from-pink-500 to-rose-600',
    trusted: true,
    logoText: 'Myntra',
  },
  {
    id: 'nykaa',
    name: 'Nykaa',
    domain: 'nykaa.com',
    category: 'Skincare & Beauty',
    badgeColor: 'from-pink-600 to-purple-600',
    trusted: true,
    logoText: 'Nykaa',
  },
  {
    id: 'tira',
    name: 'Tira Beauty',
    domain: 'tirabeauty.com',
    category: 'Skincare & Beauty',
    badgeColor: 'from-red-500 to-amber-600',
    trusted: true,
    logoText: 'Tira',
  },
  {
    id: 'amazon_in',
    name: 'Amazon India',
    domain: 'amazon.in',
    category: 'All Categories',
    badgeColor: 'from-amber-500 to-orange-600',
    trusted: true,
    logoText: 'Amazon',
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    domain: 'flipkart.com',
    category: 'Fashion & Lifestyle',
    badgeColor: 'from-blue-500 to-indigo-600',
    trusted: true,
    logoText: 'Flipkart',
  },
  {
    id: 'ajio',
    name: 'AJIO Luxe',
    domain: 'ajio.com',
    category: 'Fashion & Bags',
    badgeColor: 'from-slate-700 to-slate-900',
    trusted: true,
    logoText: 'AJIO',
  },
  {
    id: 'tatacliq',
    name: 'Tata CLiQ',
    domain: 'tatacliq.com',
    category: 'Fashion & Luxury',
    badgeColor: 'from-rose-600 to-red-700',
    trusted: true,
    logoText: 'Tata CLiQ',
  },
  {
    id: 'zara_in',
    name: 'Zara Official',
    domain: 'zara.com/in',
    category: 'Fashion & Bags',
    badgeColor: 'from-zinc-900 to-black',
    trusted: true,
    logoText: 'Zara Official',
  },
  {
    id: 'blinkit',
    name: 'Blinkit Grocery',
    domain: 'blinkit.com',
    category: 'Recipe Ingredients',
    badgeColor: 'from-yellow-400 to-yellow-600',
    trusted: true,
    logoText: 'Blinkit',
  },
  {
    id: 'zepto',
    name: 'Zepto Quick',
    domain: 'zeptonow.com',
    category: 'Recipe Ingredients',
    badgeColor: 'from-purple-600 to-pink-600',
    trusted: true,
    logoText: 'Zepto',
  }
];

export const DISCOVERY_PROMPTS = [
  {
    id: 'dress-budget',
    label: '👗 Find this dress under ₹2,000',
    text: 'Find this green satin wrap dress under ₹2,000 from verified stores',
    category: 'Fashion',
    type: 'TEXT',
    icon: 'Sparkles',
  },
  {
    id: 'instagram-look',
    label: '✨ Shop products from Instagram Reel',
    text: 'https://www.instagram.com/reel/C8xyz123FashionLook/',
    category: 'Fashion',
    type: 'INSTAGRAM_URL',
    icon: 'Instagram',
  },
  {
    id: 'skincare-serum',
    label: '🧴 Where to buy this serum in India?',
    text: 'Where can I buy this Korean Niacinamide & Snail Mucin serum with price comparison?',
    category: 'Skincare',
    type: 'TEXT',
    icon: 'ShieldCheck',
  },
  {
    id: 'recipe-youtube',
    label: '🍜 Extract ingredients from YouTube recipe',
    text: 'https://www.youtube.com/watch?v=7X89k_KoreanSpicyNoodles',
    category: 'Recipe',
    type: 'YOUTUBE_URL',
    icon: 'Youtube',
  },
  {
    id: 'bag-alternative',
    label: '👜 Find luxury bag alternatives under ₹3,500',
    text: 'Find a structured crescent leather shoulder bag alternative under ₹3,500',
    category: 'Bags',
    type: 'TEXT',
    icon: 'ShoppingBag',
  },
  {
    id: 'cheaper-recipe',
    label: '🍳 Cheaper recipe substitutions',
    text: 'Give me ingredients for authentic Carbonara and suggest budget-friendly local substitutes in India',
    category: 'Recipe',
    type: 'TEXT',
    icon: 'Utensils',
  }
];

export const CULINARY_SUBSTITUTIONS_DB = [
  {
    originalName: 'Gochujang (Korean Red Chili Paste)',
    substituteName: 'Red Chili Flakes/Powder + Tomato Paste + Brown Sugar + Soy Sauce',
    ratioNotes: 'Mix 1 tbsp tomato paste with 1 tsp red chili powder, 1/2 tsp sugar, and 1/2 tsp soy sauce to replace 1 tbsp Gochujang.',
    flavorImpact: 'Slightly less fermented funk, but captures the signature spicy, savory, and sweet depth.',
    costImpact: 'Much Cheaper' as const,
    estimatedSavingsPercentage: 65,
    preparationTip: 'Let the mixture sit for 5 minutes to allow chili flakes to bloom in the tomato paste acid.'
  },
  {
    originalName: 'Pecorino Romano / Parmigiano-Reggiano',
    substituteName: 'Aged Amul Cheese / Sharp Cheddar + Dash of Salt & MSG',
    ratioNotes: '1:1 ratio by weight. Grate finely using the smallest holes.',
    flavorImpact: 'Mildly creamier with slightly less crystalline umami crunch, but rich and melt-friendly.',
    costImpact: 'Much Cheaper' as const,
    estimatedSavingsPercentage: 70,
    preparationTip: 'Toss with pasta water off the heat to prevent clumping.'
  },
  {
    originalName: 'Mirin (Japanese Sweet Rice Wine)',
    substituteName: 'White Vinegar + Sugar OR Apple Juice + Rice Vinegar',
    ratioNotes: '1 tbsp white vinegar + 1/2 tsp sugar for every 1 tbsp of Mirin.',
    flavorImpact: 'Maintains crisp acidity and sweetness without requiring specialized liquor import.',
    costImpact: 'Much Cheaper' as const,
    estimatedSavingsPercentage: 55,
    preparationTip: 'Dissolve sugar fully in the vinegar before adding to sauces.'
  },
  {
    originalName: 'Shaoxing Cooking Wine',
    substituteName: 'Dry Sherry OR Apple Cider Vinegar + Splash of Soy Sauce',
    ratioNotes: '1:1 substitution with Dry Sherry, or 1 tsp cider vinegar per tbsp.',
    flavorImpact: 'Provides the essential aromatic wine note that cuts through rich meats.',
    costImpact: 'Slightly Cheaper' as const,
    estimatedSavingsPercentage: 40,
    preparationTip: 'Deglaze the smoking hot wok with it around the edges.'
  },
  {
    originalName: 'Heavy Whipping Cream',
    substituteName: 'Whole Milk + Melted Butter (or Thick Fresh Malai)',
    ratioNotes: '3/4 cup whole milk + 1/4 cup melted butter = 1 cup heavy cream.',
    flavorImpact: 'Rich and velvety; nearly indistinguishable in savory curries, soups, and pan sauces.',
    costImpact: 'Slightly Cheaper' as const,
    estimatedSavingsPercentage: 35,
    preparationTip: 'Blend lightly with an immersion blender for emulsion.'
  },
  {
    originalName: 'Tahini (Sesame Paste)',
    substituteName: 'Toasted White Sesame Seeds + Neutral Sunflower Oil (Blended)',
    ratioNotes: '1 cup roasted white til + 3 tbsp neutral oil blended in a small mixer jar.',
    flavorImpact: 'Fresh, nutty, and vibrant without store-bought preservative bitterness.',
    costImpact: 'Much Cheaper' as const,
    estimatedSavingsPercentage: 60,
    preparationTip: 'Toast sesame seeds on low flame until fragrant before grinding.'
  },
  {
    originalName: 'Truffle Oil / Fresh Truffles',
    substituteName: 'Toasted Dried Porcini Mushroom Powder + Garlic Herb Butter',
    ratioNotes: '1/2 tsp ground dried mushroom powder per serving.',
    flavorImpact: 'Deep, earthy, umami-rich notes without synthetic chemical perfumes.',
    costImpact: 'Much Cheaper' as const,
    estimatedSavingsPercentage: 85,
    preparationTip: 'Sprinkle right before serving over hot pasta, eggs, or fries.'
  },
  {
    originalName: 'Pine Nuts (Pignoli)',
    substituteName: 'Toasted Walnuts or Toasted Cashews',
    ratioNotes: '1:1 ratio by volume in pestos and salads.',
    flavorImpact: 'Rich buttery texture with pleasant nutty finish.',
    costImpact: 'Much Cheaper' as const,
    estimatedSavingsPercentage: 75,
    preparationTip: 'Lightly pan-roast cashews for 2 minutes to bring out natural oils.'
  }
];
