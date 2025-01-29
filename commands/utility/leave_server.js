const { SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave_server')
        .setDescription('Removes the bot from a foreign server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('server')
                .setDescription('When present, removes the server from the given guildID')
                .setRequired(true)
        ),
    private: true,
    async execute(interaction) {
        await interaction.deferReply();

        const guildID = interaction.options.getString('server');
        try {
            const guild = await interaction.client.guilds.fetch(guildID);
            console.log(guild);
            await guild.leave();

            interaction.editReply({ content: `Left the guild named ${guild.name}` });
        }
        catch(e) {
            console.log(e);
            interaction.editReply({ content: `Couldn't leave server. Check logs for info!` });
        }
    },
};