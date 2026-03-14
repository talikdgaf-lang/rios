import { useState, useEffect } from "react";
import { Search, Bookmark, ChefHat, ArrowLeft, Loader2, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateRecipeByDish, generateRecipeByIngredients, generateRecipeImage, type Recipe } from "./services/geminiService";

export default function App() {
  const [view, setView] = useState<"home" | "recipe" | "saved">("home");
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("savedRecipes");
    if (saved) {
      try {
        setSavedRecipes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved recipes", e);
      }
    }
  }, []);

  const saveRecipe = (recipe: Recipe) => {
    const isAlreadySaved = savedRecipes.some((r) => r.id === recipe.id);
    if (!isAlreadySaved) {
      const newSaved = [...savedRecipes, recipe];
      try {
        localStorage.setItem("savedRecipes", JSON.stringify(newSaved));
        setSavedRecipes(newSaved);
      } catch (e) {
        console.error("Storage full", e);
        // Try saving without image if it fails
        const recipeWithoutImage = { ...recipe, imageUrl: undefined };
        const fallbackSaved = [...savedRecipes, recipeWithoutImage];
        try {
          localStorage.setItem("savedRecipes", JSON.stringify(fallbackSaved));
          setSavedRecipes(fallbackSaved);
          alert("Recipe saved, but image was omitted due to storage limits.");
        } catch (err) {
          alert("Failed to save recipe. Storage might be full.");
        }
      }
    }
  };

  const removeRecipe = (id: string) => {
    const newSaved = savedRecipes.filter((r) => r.id !== id);
    setSavedRecipes(newSaved);
    localStorage.setItem("savedRecipes", JSON.stringify(newSaved));
  };

  const handleGenerateByDish = async (dishName: string) => {
    if (!dishName.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const recipe = await generateRecipeByDish(dishName);
      setCurrentRecipe(recipe);
      setView("recipe");
      
      // Generate image in background
      setIsGeneratingImage(true);
      const imageUrl = await generateRecipeImage(recipe.title, recipe.description);
      if (imageUrl) {
        setCurrentRecipe(prev => prev ? { ...prev, imageUrl } : null);
      }
      setIsGeneratingImage(false);
    } catch (err) {
      setError("Failed to generate recipe. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateByIngredients = async (ingredients: string) => {
    if (!ingredients.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const recipe = await generateRecipeByIngredients(ingredients);
      setCurrentRecipe(recipe);
      setView("recipe");
      
      // Generate image in background
      setIsGeneratingImage(true);
      const imageUrl = await generateRecipeImage(recipe.title, recipe.description);
      if (imageUrl) {
        setCurrentRecipe(prev => prev ? { ...prev, imageUrl } : null);
      }
      setIsGeneratingImage(false);
    } catch (err) {
      setError("Failed to generate recipe. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-12">
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-2 text-olive-dark hover:opacity-80 transition-opacity"
        >
          <ChefHat className="w-8 h-8" />
          <h1 className="text-2xl font-bold font-serif tracking-tight">RIO'S KITCHEN</h1>
        </button>
        <button
          onClick={() => setView("saved")}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border border-olive/20 hover:bg-olive/5 transition-colors"
        >
          <Bookmark className="w-4 h-4" />
          Saved ({savedRecipes.length})
        </button>
      </header>

      <main className="flex-1 relative">
        <AnimatePresence mode="wait">
          {view === "home" && (
            <HomeView
              key="home"
              onSearchDish={handleGenerateByDish}
              onSearchIngredients={handleGenerateByIngredients}
              isLoading={isLoading}
              error={error}
            />
          )}
          {view === "recipe" && currentRecipe && (
            <RecipeView
              key="recipe"
              recipe={currentRecipe}
              onBack={() => setView("home")}
              onSave={() => saveRecipe(currentRecipe)}
              isSaved={savedRecipes.some((r) => r.id === currentRecipe.id)}
              isGeneratingImage={isGeneratingImage}
            />
          )}
          {view === "saved" && (
            <SavedView
              key="saved"
              recipes={savedRecipes}
              onBack={() => setView("home")}
              onRemove={removeRecipe}
              onView={(recipe) => {
                setCurrentRecipe(recipe);
                setView("recipe");
              }}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function HomeView({
  onSearchDish,
  onSearchIngredients,
  isLoading,
  error,
}: {
  onSearchDish: (dish: string) => void;
  onSearchIngredients: (ingredients: string) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [dishInput, setDishInput] = useState("");
  const [ingredientsInput, setIngredientsInput] = useState("");
  const [activeTab, setActiveTab] = useState<"dish" | "ingredients">("dish");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryDishes: Record<string, string[]> = {
    "Breakfast": ["Uji (Porridge)", "Mandazi", "Mahamri", "Nduma (Arrow Roots)", "Ngwaci (Sweet Potatoes)", "Kenyan Pancakes"],
    "Lunch": ["Githeri", "Ugali & Sukuma Wiki", "Matoke", "Pilau", "Mukimo", "Kachumbari"],
    "Dinner": ["Nyama Choma", "Chapati & Ndengu", "Tilapia Fish & Ugali", "Kuku Paka (Chicken Curry)", "Beef Stew"],
    "Snacks": ["Samosa", "Bhajia", "Roasted Peanuts", "Cassava Crisps", "Kebab"],
    "Street Food": ["Smokies & Kachumbari", "Mutura", "Chips Mwitu", "Mahindi Choma", "Viazi Karai"]
  };

  const popularDishes = ["Ugali", "Sukuma Wiki", "Nyama Choma", "Chapati", "Githeri", "Pilau", "Mandazi"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-10"
    >
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-4xl md:text-5xl font-serif text-olive-dark">What are we cooking today?</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Discover authentic Kenyan recipes instantly. Search by dish name or use what you have in your kitchen.
        </p>
      </div>

      <div className="card p-6 md:p-8 max-w-2xl mx-auto">
        <div className="flex gap-4 mb-6 border-b border-gray-100 pb-4">
          <button
            onClick={() => setActiveTab("dish")}
            className={`pb-2 text-sm font-medium transition-colors relative ${
              activeTab === "dish" ? "text-olive-dark" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Search by Dish
            {activeTab === "dish" && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-dark" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("ingredients")}
            className={`pb-2 text-sm font-medium transition-colors relative ${
              activeTab === "ingredients" ? "text-olive-dark" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Use Ingredients
            {activeTab === "ingredients" && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-dark" />
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl text-sm">
            {error}
          </div>
        )}

        {activeTab === "dish" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearchDish(dishInput);
            }}
            className="space-y-4"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="e.g., Pilau, Chapati, Sukuma Wiki..."
                value={dishInput}
                onChange={(e) => setDishInput(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-olive/20 outline-none text-lg transition-shadow"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !dishInput.trim()}
              className="w-full olive-button flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate Recipe"}
            </button>
            
            <div className="pt-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Popular Dishes</p>
              <div className="flex flex-wrap gap-2">
                {popularDishes.map(dish => (
                  <button
                    key={dish}
                    type="button"
                    onClick={() => setDishInput(dish)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                  >
                    {dish}
                  </button>
                ))}
              </div>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearchIngredients(ingredientsInput);
            }}
            className="space-y-4"
          >
            <div className="relative">
              <Search className="absolute left-4 top-6 text-gray-400 w-5 h-5" />
              <textarea
                placeholder="e.g., maize flour, onions, tomatoes, beef..."
                value={ingredientsInput}
                onChange={(e) => setIngredientsInput(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-olive/20 outline-none text-lg transition-shadow min-h-[120px] resize-none"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !ingredientsInput.trim()}
              className="w-full olive-button flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Find a Meal"}
            </button>
          </form>
        )}
      </div>

      <div className="pt-8">
        <p className="text-center text-sm text-gray-500 uppercase tracking-wider font-semibold mb-6">Categories</p>
        <div className="flex justify-center flex-wrap gap-3">
          {Object.keys(categoryDishes).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`px-5 py-2.5 border rounded-full text-sm font-medium transition-colors shadow-sm ${
                selectedCategory === cat
                  ? "bg-olive text-white border-olive"
                  : "bg-white border-gray-200 hover:border-olive/30 hover:text-olive-dark"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {selectedCategory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-6"
            >
              <div className="p-6 bg-olive/5 rounded-2xl border border-olive/10">
                <h3 className="text-lg font-serif text-olive-dark mb-4 text-center">
                  {selectedCategory} Dishes
                </h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {categoryDishes[selectedCategory].map((dish) => (
                    <button
                      key={dish}
                      onClick={() => onSearchDish(dish)}
                      className="px-4 py-2 bg-white hover:bg-olive/10 border border-olive/20 rounded-xl text-sm text-gray-700 transition-colors"
                    >
                      {dish}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function RecipeView({
  recipe,
  onBack,
  onSave,
  isSaved,
  isGeneratingImage,
}: {
  recipe: Recipe;
  onBack: () => void;
  onSave: () => void;
  isSaved: boolean;
  isGeneratingImage: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 pb-12"
    >
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onSave}
          disabled={isSaved}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            isSaved
              ? "bg-olive/10 text-olive-dark cursor-default"
              : "bg-white border border-gray-200 hover:border-olive/30 shadow-sm"
          }`}
        >
          <Save className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
          {isSaved ? "Saved" : "Save Recipe"}
        </button>
      </div>

      <div className="card p-8 md:p-10">
        {recipe.imageUrl ? (
          <img 
            src={recipe.imageUrl} 
            alt={recipe.title} 
            className="w-full h-64 md:h-80 object-cover rounded-2xl mb-8 shadow-sm" 
            referrerPolicy="no-referrer"
          />
        ) : isGeneratingImage ? (
          <div className="w-full h-64 md:h-80 bg-gray-100 rounded-2xl mb-8 animate-pulse flex flex-col items-center justify-center text-olive/40">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm font-medium">Cooking up an image...</span>
          </div>
        ) : null}

        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 bg-olive/10 text-olive-dark text-xs font-bold uppercase tracking-widest rounded-full mb-4">
            {recipe.category}
          </span>
          <h2 className="text-4xl md:text-5xl font-serif text-olive-dark mb-4">{recipe.title}</h2>
          <p className="text-gray-600 max-w-xl mx-auto text-lg">{recipe.description}</p>
          
          <div className="flex items-center justify-center gap-8 mt-8 pt-8 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Time</p>
              <p className="font-medium text-gray-900">{recipe.cookingTime}</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Serves</p>
              <p className="font-medium text-gray-900">{recipe.servingSize}</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_2fr] gap-12">
          <div>
            <h3 className="text-xl font-serif text-olive-dark mb-6 border-b border-gray-100 pb-2">Ingredients</h3>
            <ul className="space-y-3">
              {recipe.ingredients.map((ingredient, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-olive/40 mt-2 shrink-0" />
                  <span>{ingredient}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-serif text-olive-dark mb-6 border-b border-gray-100 pb-2">Instructions</h3>
            <ol className="space-y-6">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-olive/10 text-olive-dark font-serif font-bold shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-gray-700 pt-1 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>

            {recipe.tips && recipe.tips.length > 0 && (
              <div className="mt-10 p-6 bg-amber-50 rounded-2xl border border-amber-100">
                <h4 className="font-serif text-amber-900 text-lg mb-3 flex items-center gap-2">
                  <ChefHat className="w-5 h-5" />
                  Chef's Tips
                </h4>
                <ul className="space-y-2">
                  {recipe.tips.map((tip, i) => (
                    <li key={i} className="text-amber-800/80 text-sm flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SavedView({
  recipes,
  onBack,
  onRemove,
  onView,
}: {
  recipes: Recipe[];
  onBack: () => void;
  onRemove: (id: string) => void;
  onView: (recipe: Recipe) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-3xl font-serif text-olive-dark">Saved Recipes</h2>
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-20 card">
          <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-serif text-gray-900 mb-2">No saved recipes yet</h3>
          <p className="text-gray-500">Recipes you save will appear here for quick access.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="card flex flex-col hover:shadow-md transition-shadow overflow-hidden">
              {recipe.imageUrl ? (
                <div className="h-40 w-full bg-gray-100">
                  <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="h-40 w-full bg-olive/5 flex items-center justify-center">
                  <ChefHat className="w-10 h-10 text-olive/20" />
                </div>
              )}
              <div className="p-6 flex flex-col flex-1">
                <div className="mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-olive/60 mb-2 block">
                    {recipe.category}
                  </span>
                  <h3 className="text-xl font-serif text-gray-900 mb-2 line-clamp-1">{recipe.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">{recipe.description}</p>
                </div>
                
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-50">
                  <button
                    onClick={() => onView(recipe)}
                    className="text-sm font-medium text-olive-dark hover:underline"
                  >
                    View Recipe
                  </button>
                  <button
                    onClick={() => onRemove(recipe.id)}
                    className="text-sm text-red-500 hover:text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
