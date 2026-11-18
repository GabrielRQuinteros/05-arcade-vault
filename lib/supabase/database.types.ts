/*
 * ============================================================================
 *  TIPOS DE LA BASE DE DATOS DE SUPABASE
 * ============================================================================
 *
 *  ¿Qué es este archivo?
 *  ---------------------
 *  Es una "foto" de cómo está organizada nuestra base de datos en Supabase
 *  (qué tablas hay, qué columnas tiene cada una, de qué tipo es cada columna),
 *  escrita en el idioma de TypeScript.
 *
 *  ¿Para qué sirve?
 *  ----------------
 *  Gracias a este archivo, cuando escribimos código que lee o guarda datos,
 *  el editor nos ayuda: nos sugiere los nombres de las tablas y columnas, y
 *  nos marca un error si escribimos mal un nombre o si intentamos guardar un
 *  texto donde va un número. Sin este archivo, esos errores recién
 *  aparecerían cuando la app ya está funcionando.
 *
 *  ¿De dónde salió?
 *  ----------------
 *  NO lo escribió una persona. Lo generó automáticamente la herramienta
 *  `generate_typescript_types` del MCP de Supabase, leyendo la base de datos
 *  real. Los comentarios sí se agregaron a mano para explicarlo.
 *
 *  ⚠️  IMPORTANTE: cada vez que se cree o cambie una tabla en Supabase, este
 *  archivo hay que volver a generarlo. Al regenerarlo, estos comentarios se
 *  borran y hay que volver a ponerlos.
 *
 *  Estado actual
 *  -------------
 *  Hoy solo existen las 5 tablas de Better Auth (SPEC 06): `user`, `session`,
 *  `account`, `verification` y `jwks`. Tienen RLS activo y SIN policies:
 *  con la publishable key la Data API no puede leerlas ni escribirlas.
 *  Better Auth las usa directo por `DATABASE_URL` (lib/auth/auth.ts), no por
 *  el cliente de Supabase. Estos tipos quedan por si una spec futura las une
 *  (por ejemplo, una FK de `scores` a `user`).
 */

/**
 * `Json` — Cualquier dato con formato JSON.
 *
 * Algunas columnas de una base de datos pueden guardar datos "libres" en
 * formato JSON (por ejemplo, la configuración de un juego). Este tipo dice
 * qué valores son válidos ahí:
 *
 *   - un texto           → "hola"
 *   - un número          → 42
 *   - verdadero o falso  → true
 *   - vacío              → null
 *   - un objeto          → { "nivel": 3, "sonido": true }
 *   - una lista          → [1, 2, 3]
 *
 * Los objetos y las listas pueden tener adentro más objetos y listas, sin
 * límite (por eso el tipo se usa a sí mismo en su definición).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * `Database` — El mapa completo de nuestra base de datos.
 *
 * Es el tipo MÁS importante del archivo. Se lo pasamos a los clientes de
 * Supabase (en `client.ts` y `server.ts`) así:
 *
 *     createBrowserClient<Database>(...)
 *
 * A partir de ahí, cada vez que hagamos una consulta, TypeScript sabe qué
 * tablas existen y qué datos devuelve cada una.
 */
export type Database = {
  /*
   * `__InternalSupabase` — Dato de uso interno. No hace falta tocarlo.
   *
   * Indica la versión de PostgREST, que es el programa que Supabase usa para
   * convertir nuestras consultas en pedidos a la base de datos. La librería
   * de Supabase lee este número para ajustar algunos detalles por su cuenta.
   * Los dos guiones bajos al principio del nombre son una convención para
   * decir "esto es interno, no es para usar directamente".
   */
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };

  /*
   * `public` — El "esquema" principal de la base de datos.
   *
   * Un esquema es como una carpeta que agrupa tablas y otros objetos.
   * Supabase guarda nuestras tablas en la carpeta llamada `public`.
   *
   * Adentro hay cinco secciones. Hoy solo `Tables` tiene contenido. La escritura
   * `[_ in never]: never` es la forma que tiene TypeScript de decir
   * "esta lista no tiene ningún elemento".
   */
  public: {
    /*
     * `Tables` — Las tablas, donde se guardan los datos.
     * Hoy: las 5 tablas de Better Auth. Ejemplo futuro: `scores`.
     *
     * Cada tabla aparece en tres versiones:
     *   - `Row`    → cómo es una fila cuando la LEEMOS (todas las columnas).
     *   - `Insert` → qué datos hay que mandar para CREAR una fila nueva
     *                (las columnas que se completan solas, como el id o la
     *                fecha de creación, son opcionales).
     *   - `Update` → qué datos se pueden mandar para MODIFICAR una fila
     *                (todo es opcional: mandamos solo lo que cambia).
     */
    Tables: {
      account: {
        Row: {
          accessToken: string | null;
          accessTokenExpiresAt: string | null;
          accountId: string;
          createdAt: string;
          id: string;
          idToken: string | null;
          password: string | null;
          providerId: string;
          refreshToken: string | null;
          refreshTokenExpiresAt: string | null;
          scope: string | null;
          updatedAt: string;
          userId: string;
        };
        Insert: {
          accessToken?: string | null;
          accessTokenExpiresAt?: string | null;
          accountId: string;
          createdAt?: string;
          id: string;
          idToken?: string | null;
          password?: string | null;
          providerId: string;
          refreshToken?: string | null;
          refreshTokenExpiresAt?: string | null;
          scope?: string | null;
          updatedAt: string;
          userId: string;
        };
        Update: {
          accessToken?: string | null;
          accessTokenExpiresAt?: string | null;
          accountId?: string;
          createdAt?: string;
          id?: string;
          idToken?: string | null;
          password?: string | null;
          providerId?: string;
          refreshToken?: string | null;
          refreshTokenExpiresAt?: string | null;
          scope?: string | null;
          updatedAt?: string;
          userId?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_userId_fkey";
            columns: ["userId"];
            isOneToOne: false;
            referencedRelation: "user";
            referencedColumns: ["id"];
          },
        ];
      };
      jwks: {
        Row: {
          alg: string | null;
          createdAt: string;
          crv: string | null;
          expiresAt: string | null;
          id: string;
          privateKey: string;
          publicKey: string;
        };
        Insert: {
          alg?: string | null;
          createdAt: string;
          crv?: string | null;
          expiresAt?: string | null;
          id: string;
          privateKey: string;
          publicKey: string;
        };
        Update: {
          alg?: string | null;
          createdAt?: string;
          crv?: string | null;
          expiresAt?: string | null;
          id?: string;
          privateKey?: string;
          publicKey?: string;
        };
        Relationships: [];
      };
      session: {
        Row: {
          createdAt: string;
          expiresAt: string;
          id: string;
          ipAddress: string | null;
          token: string;
          updatedAt: string;
          userAgent: string | null;
          userId: string;
        };
        Insert: {
          createdAt?: string;
          expiresAt: string;
          id: string;
          ipAddress?: string | null;
          token: string;
          updatedAt: string;
          userAgent?: string | null;
          userId: string;
        };
        Update: {
          createdAt?: string;
          expiresAt?: string;
          id?: string;
          ipAddress?: string | null;
          token?: string;
          updatedAt?: string;
          userAgent?: string | null;
          userId?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_userId_fkey";
            columns: ["userId"];
            isOneToOne: false;
            referencedRelation: "user";
            referencedColumns: ["id"];
          },
        ];
      };
      user: {
        Row: {
          createdAt: string;
          displayUsername: string | null;
          email: string;
          emailVerified: boolean;
          id: string;
          image: string | null;
          name: string;
          updatedAt: string;
          username: string | null;
        };
        Insert: {
          createdAt?: string;
          displayUsername?: string | null;
          email: string;
          emailVerified: boolean;
          id: string;
          image?: string | null;
          name: string;
          updatedAt?: string;
          username?: string | null;
        };
        Update: {
          createdAt?: string;
          displayUsername?: string | null;
          email?: string;
          emailVerified?: boolean;
          id?: string;
          image?: string | null;
          name?: string;
          updatedAt?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      verification: {
        Row: {
          createdAt: string;
          expiresAt: string;
          id: string;
          identifier: string;
          updatedAt: string;
          value: string;
        };
        Insert: {
          createdAt?: string;
          expiresAt: string;
          id: string;
          identifier: string;
          updatedAt?: string;
          value: string;
        };
        Update: {
          createdAt?: string;
          expiresAt?: string;
          id?: string;
          identifier?: string;
          updatedAt?: string;
          value?: string;
        };
        Relationships: [];
      };
    };

    /*
     * `Views` — Las vistas.
     * Una vista es una "tabla virtual": no guarda datos propios, sino que
     * muestra datos de otras tablas ya filtrados u ordenados.
     * Ejemplo futuro: una vista `top_10` con los 10 mejores puntajes.
     */
    Views: {
      [_ in never]: never;
    };

    /*
     * `Functions` — Las funciones de la base de datos.
     * Son pequeños programas que viven dentro de la base de datos y que
     * podemos ejecutar desde la app. Por ejemplo, una función que calcule
     * el ranking de un jugador.
     */
    Functions: {
      [_ in never]: never;
    };

    /*
     * `Enums` — Listas cerradas de valores permitidos.
     * Sirven para columnas que solo pueden tener ciertos valores fijos.
     * Ejemplo futuro: una dificultad que solo puede ser "facil", "normal"
     * o "dificil". Cualquier otro valor sería un error.
     */
    Enums: {
      [_ in never]: never;
    };

    /*
     * `CompositeTypes` — Tipos de dato "a medida".
     * Permiten agrupar varios datos en uno solo (por ejemplo, una posición
     * formada por "x" e "y"). Se usan muy poco.
     */
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

/*
 * ----------------------------------------------------------------------------
 *  TIPOS AUXILIARES (privados)
 * ----------------------------------------------------------------------------
 *  Los dos tipos siguientes NO se usan fuera de este archivo (no tienen
 *  `export`). Son piezas de ayuda para construir los atajos de más abajo.
 */

/**
 * `DatabaseWithoutInternals` — El mapa de la base de datos, pero sin el dato
 * interno `__InternalSupabase`. Así nos quedamos solo con las "carpetas"
 * reales (como `public`).
 */
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

/**
 * `DefaultSchema` — La carpeta que se usa por defecto: `public`.
 * Sirve para que en los atajos de abajo no tengamos que escribir "public"
 * cada vez.
 */
type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

/*
 * ----------------------------------------------------------------------------
 *  ATAJOS (los que más vamos a usar en el día a día)
 * ----------------------------------------------------------------------------
 *  Sin estos atajos, para obtener el tipo de una fila de la tabla `scores`
 *  habría que escribir algo larguísimo:
 *
 *      Database["public"]["Tables"]["scores"]["Row"]
 *
 *  Con los atajos alcanza con:
 *
 *      Tables<"scores">
 *
 *  ¿Por qué el código de los atajos se ve tan complicado?
 *  Porque aceptan DOS formas de uso:
 *
 *    1) La normal (la que vamos a usar):   Tables<"scores">
 *    2) Indicando otra carpeta distinta de `public`:
 *                                          Tables<{ schema: "otra" }, "scores">
 *
 *  Todo ese código lleno de signos `?` y `:` es TypeScript preguntándose
 *  "¿me pasaron la forma 1 o la forma 2?" y buscando el tipo correcto en
 *  cada caso. No hace falta entenderlo línea por línea para usarlo.
 *
 *  Mientras no existan tablas, estos atajos no se pueden usar todavía
 *  (no hay ningún nombre de tabla válido para pasarles).
 */

/**
 * `Tables<"nombre">` — Cómo es una fila al LEERLA de una tabla (o vista).
 *
 * Ejemplo de uso futuro:
 *
 *     type Puntaje = Tables<"scores">;
 *     // → { id: number; player: string; points: number; created_at: string }
 */
export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

/**
 * `TablesInsert<"nombre">` — Qué datos hay que mandar para CREAR una fila
 * nueva en una tabla.
 *
 * Las columnas que la base de datos completa sola (como el `id` o la fecha
 * de creación) aparecen como opcionales.
 *
 * Ejemplo de uso futuro:
 *
 *     const nuevo: TablesInsert<"scores"> = { player: "Ana", points: 1200 };
 */
export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

/**
 * `TablesUpdate<"nombre">` — Qué datos se pueden mandar para MODIFICAR una
 * fila que ya existe.
 *
 * Todas las columnas son opcionales: solo mandamos las que queremos cambiar.
 *
 * Ejemplo de uso futuro:
 *
 *     const cambio: TablesUpdate<"scores"> = { points: 1500 };
 */
export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

/**
 * `Enums<"nombre">` — Los valores permitidos de una lista cerrada (enum).
 *
 * Ejemplo de uso futuro:
 *
 *     type Dificultad = Enums<"difficulty">;
 *     // → "facil" | "normal" | "dificil"
 */
export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

/**
 * `CompositeTypes<"nombre">` — Cómo es un tipo de dato "a medida" (ver la
 * explicación de `CompositeTypes` más arriba). Se usa muy poco.
 *
 * Ejemplo de uso futuro:
 *
 *     type Posicion = CompositeTypes<"position">;
 *     // → { x: number; y: number }
 */
export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

/**
 * `Constants` — Los valores de los enums, disponibles mientras la app corre.
 *
 * Todo lo anterior son TIPOS: solo existen mientras escribimos código y
 * desaparecen cuando la app se ejecuta. `Constants`, en cambio, es un valor
 * REAL que sí existe en la app funcionando.
 *
 * Sirve, por ejemplo, para mostrar en pantalla un selector con todas las
 * dificultades posibles sin tener que escribirlas a mano:
 *
 *     Constants.public.Enums.difficulty   // → ["facil", "normal", "dificil"]
 *
 * Hoy está vacío porque todavía no hay ningún enum.
 */
export const Constants = {
  public: {
    Enums: {},
  },
} as const;
