// Custom SKU Search für Predictive Search

(function() {

  const searchInput = document.querySelector('input[type="search"]');

  const predictiveSearchResults = document.querySelector('predictive-search');

 

  if (!searchInput || !predictiveSearchResults) return;

 

  // Debounce Funktion für Performance

  function debounce(func, wait) {

    let timeout;

    return function executedFunction(...args) {

      const later = () => {

        clearTimeout(timeout);

        func(...args);

      };

      clearTimeout(timeout);

      timeout = setTimeout(later, wait);

    };

  }

 

  // SKU-Suche über Storefront API

  async function searchBySKU(query) {

    if (!query || query.length < 3) return [];

   

    const graphqlQuery = `

      query searchProducts($query: String!) {

        products(first: 5, query: $query) {

          edges {

            node {

              id

              title

              handle

              featuredImage {

                url

                altText

              }

              variants(first: 10) {

                edges {

                  node {

                    sku

                    title

                    price {

                      amount

                      currencyCode

                    }

                  }

                }

              }

            }

          }

        }

      }

    `;

   

    try {

      const response = await fetch('/api/2024-01/graphql.json', {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          'X-Shopify-Storefront-Access-Token': 'YOUR_STOREFRONT_ACCESS_TOKEN' // Muss ersetzt werden

        },

        body: JSON.stringify({

          query: graphqlQuery,

          variables: { query: `sku:*${query}*` }

        })

      });

     

      const data = await response.json();

      return data.data?.products?.edges || [];

    } catch (error) {

      console.error('SKU search error:', error);

      return [];

    }

  }

 

  // Füge SKU-Ergebnisse zu Predictive Search hinzu

  const enhancedSearch = debounce(async function(event) {

    const query = event.target.value.trim();

   

    // Prüfe ob es eine SKU-Suche sein könnte (z.B. enthält Bindestriche oder ist alphanumerisch)

    const skuPattern = /^[A-Z0-9\-_]+$/i;

   

    if (skuPattern.test(query)) {

      const skuResults = await searchBySKU(query);

     

      if (skuResults.length > 0) {

        // Füge SKU-Ergebnisse zur Anzeige hinzu

        displaySKUResults(skuResults);

      }

    }

  }, 300);

 

  searchInput.addEventListener('input', enhancedSearch);

 

  function displaySKUResults(results) {

    // Erstelle oder finde den SKU-Ergebnisse Container

    let skuContainer = document.querySelector('.sku-search-results');

   

    if (!skuContainer) {

      skuContainer = document.createElement('div');

      skuContainer.className = 'sku-search-results';

      predictiveSearchResults.prepend(skuContainer);

    }

   

    skuContainer.innerHTML = '<div class="sku-results-header">Artikel nach SKU:</div>';

   

    results.forEach(({ node: product }) => {

      const matchingVariant = product.variants.edges.find(({ node: variant }) =>

        variant.sku && variant.sku.toLowerCase().includes(searchInput.value.toLowerCase())

      );

     

      if (matchingVariant) {

        const resultItem = `

          <a href="/products/${product.handle}" class="sku-result-item">

            ${product.featuredImage ? `<img src="${product.featuredImage.url}" alt="${product.title}" width="50">` : ''}

            <div class="sku-result-details">

              <div class="sku-result-title">${product.title}</div>

              <div class="sku-result-sku">SKU: ${matchingVariant.node.sku}</div>

            </div>

          </a>

        `;

        skuContainer.innerHTML += resultItem;

      }

    });

  }

})();