(ns metabase.models.database
  (:require [cheshire.generate :refer [add-encoder encode-map]]
            [korma.core :as k]
            [metabase.db :refer [cascade-delete sel]]
            [metabase.models.interface :as i]
            [metabase.util :as u]))

(def ^:const protected-password
  "The string to replace passwords with when serializing Databases."
  "**MetabasePass**")

(i/defentity Database :metabase_database)

(defn- post-select [{:keys [engine] :as database}]
  (if-not engine database
          (assoc database :features (or (when-let [driver ((resolve 'metabase.driver/engine->driver) engine)]
                                          (seq ((resolve 'metabase.driver/features) driver)))
                                        []))))

(defn- pre-cascade-delete [{:keys [id]}]
  (cascade-delete 'Card  :database_id id)
  (cascade-delete 'Table :db_id id))

(defn ^:hydrate tables
  "Return the `Tables` associated with this `Database`."
  [{:keys [id]}]
  (sel :many 'Table :db_id id, :active true, (k/order :display_name :ASC)))

(extend (class Database)
  i/IEntity
  (merge i/IEntityDefaults
         {:hydration-keys     (constantly [:database :db])
          :types              (constantly {:details :json, :engine :keyword})
          :timestamped?       (constantly true)
          :can-read?          (constantly true)
          :can-write?         i/superuser?
          :post-select        post-select
          :pre-cascade-delete pre-cascade-delete}))
