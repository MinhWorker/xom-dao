INSERT INTO "inventory_items" ("user_id", "item_id")
SELECT users.id, 'core:avatar-' || legacy.avatar
FROM users
CROSS JOIN (
	VALUES
		('long'),
		('dog'),
		('fox'),
		('panda'),
		('frog'),
		('tiger'),
		('rabbit'),
		('bear'),
		('koala'),
		('monkey'),
		('pig'),
		('hamster'),
		('lion'),
		('unicorn'),
		('penguin'),
		('owl'),
		('chick'),
		('octopus'),
		('alien'),
		('ghost')
) AS legacy(avatar)
ON CONFLICT DO NOTHING;
