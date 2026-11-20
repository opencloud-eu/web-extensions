# On OSX the PATH variable isn't exported unless "SHELL" is also set, see: http://stackoverflow.com/a/25506676
SHELL = /bin/bash
NODE_MODULES := ${CURDIR}/node_modules
export PATH := node_modules/.bin:$(PATH)

# Where to find apps (it can be multiple paths).
APPS = $(shell find packages -maxdepth 1 -name 'web-app-*')

node_modules: package.json pnpm-lock.yaml
	[ -n "${NO_INSTALL}" ] || pnpm install --frozen-lockfile
	touch ${NODE_MODULES}

.PHONY: l10n-push
l10n-push:
	@for app in $(APPS); \
    do \
        (cd $$app/l10n && tx push -s); \
    done;

.PHONY: l10n-pull
l10n-pull:
	@for app in $(APPS); \
    do \
        (cd $$app/l10n && rm locale/**/app.po && tx pull -a); \
    done;

.PHONY: l10n-clean
l10n-clean:
	rm -f $(foreach app,$(APPS),$(app)/l10n/template.pot); \
    rm -rf $(foreach app,$(APPS),$(app)/l10n/locale);

.PHONY: l10n-read
l10n-read: node_modules ./template.pot

.PHONY: l10n-write
l10n-write: node_modules ./translations.json

# Create a main .pot template, then generate .po files for each available language.
# Thanks to Systematic: https://github.com/Polyconseil/systematic/blob/866d5a/mk/main.mk#L167-L183
./template.pot:
# Extract gettext strings from each apps templates files and create a POT dictionary template.
# Generate .po files for each available language.
	@for app in $(APPS); \
	do \
		(cd $$app && pnpm exec vue-gettext-extract --config ../../gettext.config.cjs); \
	done;

# Generate translations.json file from all available apps .pot templates.
.PHONY: ./translations.json
./translations.json:
	@for app in $(APPS); \
	do \
		(cd $$app && pnpm exec vue-gettext-compile --config ../../gettext.config.cjs); \
	done && \
	node dev/scripts/check-translations.ts $(foreach app,$(APPS),$(app)/l10n/translations.json)