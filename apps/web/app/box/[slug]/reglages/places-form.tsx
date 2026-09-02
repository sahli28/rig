'use client';

import { useActionState } from 'react';
import { useI18n } from '@rig/ui/i18n';
import styles from './reglages.module.css';
import { Feedback, SubmitButton } from './form-bits';
import { addLocation, addRoom, archiveRoom } from './actions';
import { IDLE, type ActionState } from './action-state';

type Adresse = { id: string; name: string; city: string | null };
type Salle = { id: string; location_id: string; name: string; capacity: number };

/**
 * Adresses et salles — `locations` et `rooms`.
 *
 * Une salle appartient à une adresse **du même tenant** : la clé étrangère est
 * composite en base (`rooms_location_same_tenant`), et la liste déroulante ne
 * propose que les adresses de la box active. Deux couches, comme partout.
 */
export function PlacesForm({
  slug,
  adresses,
  salles,
}: {
  slug: string;
  adresses: Adresse[];
  salles: Salle[];
}) {
  const { t } = useI18n();

  const [etatAdresse, actionAdresse] = useActionState<ActionState, FormData>(
    addLocation.bind(null, slug),
    IDLE,
  );
  const [etatSalle, actionSalle] = useActionState<ActionState, FormData>(
    addRoom.bind(null, slug),
    IDLE,
  );

  return (
    <>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('settings.places_title')}</h2>
        <p className={styles.help}>{t('settings.places_help')}</p>

        {adresses.length === 0 ? (
          <p className={styles.empty}>{t('settings.places_empty')}</p>
        ) : (
          <ul className={styles.list}>
            {adresses.map((adresse) => (
              <li key={adresse.id} className={styles.row}>
                <span className={styles.rowMain}>{adresse.name}</span>
                <span className={styles.rowMeta}>{adresse.city ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}

        <form action={actionAdresse}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="location-name">
                {t('settings.places_name')}
              </label>
              <input id="location-name" name="name" className={styles.input} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="location-address">
                {t('settings.places_address')}
              </label>
              <input id="location-address" name="address" className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="location-postal">
                {t('settings.places_postal_code')}
              </label>
              <input id="location-postal" name="postal_code" className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="location-city">
                {t('settings.places_city')}
              </label>
              <input id="location-city" name="city" className={styles.input} />
            </div>
          </div>

          <div className={styles.actions}>
            <SubmitButton label={t('settings.places_add')} />
            <Feedback state={etatAdresse} />
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('settings.rooms_title')}</h2>
        <p className={styles.help}>{t('settings.rooms_help')}</p>

        {salles.length === 0 ? (
          <p className={styles.empty}>{t('settings.rooms_empty')}</p>
        ) : (
          <ul className={styles.list}>
            {salles.map((salle) => (
              <li key={salle.id} className={styles.row}>
                <span className={styles.rowMain}>{salle.name}</span>
                <span className={styles.rowMeta}>
                  {t('settings.rooms_capacity_value', { capacity: String(salle.capacity) })}
                </span>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => void archiveRoom(slug, salle.id)}
                >
                  {t('settings.rooms_archive')}
                </button>
              </li>
            ))}
          </ul>
        )}

        {adresses.length === 0 ? (
          <p className={styles.empty}>{t('settings.rooms_needs_location')}</p>
        ) : (
          <form action={actionSalle}>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="room-location">
                  {t('settings.rooms_location')}
                </label>
                <select id="room-location" name="location_id" className={styles.select} required>
                  {adresses.map((adresse) => (
                    <option key={adresse.id} value={adresse.id}>
                      {adresse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="room-name">
                  {t('settings.rooms_name')}
                </label>
                <input id="room-name" name="name" className={styles.input} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="room-capacity">
                  {t('settings.rooms_capacity')}
                </label>
                <input
                  id="room-capacity"
                  name="capacity"
                  className={styles.input}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  defaultValue={16}
                  required
                />
              </div>
            </div>

            <div className={styles.actions}>
              <SubmitButton label={t('settings.rooms_add')} />
              <Feedback state={etatSalle} />
            </div>
          </form>
        )}
      </section>
    </>
  );
}
