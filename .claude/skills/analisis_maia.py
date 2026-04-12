from financetoolkit import Toolkit

API_KEY = "87etVkEnSmcBXp2yDkeGyiAq1PQfWrNL"
# Inicializamos para Coca-Cola (KO)
compania = Toolkit(["KO"], api_key=API_KEY)

print("--- REPORTE DE DIVIDENDOS PARA MAIA ---")

# Usamos los nombres exactos que descubrimos
yield_data = compania.ratios.get_dividend_yield()
payout_data = compania.ratios.get_dividend_payout_ratio()

if yield_data is not None:
    print("\n[1. Dividend Yield Histórico]")
    # Mostramos los últimos 3 años para que sea legible
    print(yield_data.tail(3))
    
    print("\n[2. Dividend Payout Ratio]")
    print(payout_data.tail(3))
    
    print("\n--- Análisis completado con éxito ---")
else:
    print("Error al recuperar los datos.")