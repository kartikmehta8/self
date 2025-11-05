import { unpackReveal } from "../circuits/formatOutputs.js";
import {
    SELFPER_PUBLIC_SIGNALS_ATTESTATION_ID,
    SELFPER_PUBLIC_SIGNALS_FORBIDDEN_COUNTRIES_PACKED,
    SELFPER_PUBLIC_SIGNALS_OFAC_NAME_DOB_SMT_ROOT,
    SELFPER_PUBLIC_SIGNALS_REVEALED_DATA_PACKED,
    SELFPER_PUBLIC_SIGNALS_REVEALED_DATA_PACKED_LENGTH,
    SELFPER_PUBLIC_SIGNALS_NULLIFIER,
    SELFPER_PUBLIC_SIGNALS_SCOPE,
    SELFPER_PUBLIC_SIGNALS_OFAC_NAME_YOB_SMT_ROOT,
    SELFPER_PUBLIC_SIGNALS_FORBIDDEN_COUNTRIES_PACKED_LENGTH,
    SELFPER_PUBLIC_SIGNALS_CURRENT_DATE,
    SELFPER_PUBLIC_SIGNALS_CURRENT_DATE_LENGTH,
    SELFPER_PUBLIC_SIGNALS_USER_IDENTIFIER
} from "./constants.js";
import { SelfperDisclosePublicInput } from "./types.js";

export const decodePublicSignals = (publicSignals: string[]) => {
    const revealedDataPacked = publicSignals.slice(SELFPER_PUBLIC_SIGNALS_REVEALED_DATA_PACKED, SELFPER_PUBLIC_SIGNALS_REVEALED_DATA_PACKED + SELFPER_PUBLIC_SIGNALS_REVEALED_DATA_PACKED_LENGTH);
    const forbiddenCountriesPacked = publicSignals.slice(SELFPER_PUBLIC_SIGNALS_FORBIDDEN_COUNTRIES_PACKED, SELFPER_PUBLIC_SIGNALS_FORBIDDEN_COUNTRIES_PACKED + SELFPER_PUBLIC_SIGNALS_FORBIDDEN_COUNTRIES_PACKED_LENGTH);
    const forbiddenCountriesUnpacked = unpackReveal(forbiddenCountriesPacked, 'id');

    const nullifier = publicSignals[SELFPER_PUBLIC_SIGNALS_NULLIFIER];
    const scope = publicSignals[SELFPER_PUBLIC_SIGNALS_SCOPE];
    const ofacNameDobSmtRoot = publicSignals[SELFPER_PUBLIC_SIGNALS_OFAC_NAME_DOB_SMT_ROOT];
    const ofacNameYobSmtRoot = publicSignals[SELFPER_PUBLIC_SIGNALS_OFAC_NAME_YOB_SMT_ROOT];
    const attestationId = publicSignals[SELFPER_PUBLIC_SIGNALS_ATTESTATION_ID];
    const currentDate = publicSignals.slice(SELFPER_PUBLIC_SIGNALS_CURRENT_DATE, SELFPER_PUBLIC_SIGNALS_CURRENT_DATE + SELFPER_PUBLIC_SIGNALS_CURRENT_DATE_LENGTH);
    const userIdentifier = publicSignals[SELFPER_PUBLIC_SIGNALS_USER_IDENTIFIER];

    const selfperDisclosePublicInput: SelfperDisclosePublicInput = {
        attestation_id: attestationId,
        revealedData_packed: revealedDataPacked,
        forbidden_countries_list_packed: forbiddenCountriesUnpacked,
        nullifier,
        scope,
        ofac_name_dob_smt_root: ofacNameDobSmtRoot,
        ofac_name_yob_smt_root: ofacNameYobSmtRoot,
        user_identifier: userIdentifier,
        current_date: currentDate,
    }
    return selfperDisclosePublicInput;
}
